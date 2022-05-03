import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Token, Token__factory, Dao__factory, Dao } from "../typechain";

describe("My awesome dao contract", function () {
  // const tokenAddr = '0xAC2384A436f1Ff3CB0E5F3104dC229754199bbbd';
  let Token: Token__factory;
  let token: Token;
  let Dao: Dao__factory;
  let dao: Dao;
  let owner: SignerWithAddress;
  let chair: SignerWithAddress;
  let voter1: SignerWithAddress;
  let voter2: SignerWithAddress;
  let voter3: SignerWithAddress;

  let addrs: SignerWithAddress[];

  const jsonAbi = [
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "newPercent",
          "type": "uint256"
        }
      ],
      "name": "changeFee",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }];
  const iface = new ethers.utils.Interface(jsonAbi);
  const newFee = 50;
  const calldata = iface.encodeFunctionData('changeFee', [newFee]);
  let recipient: string;

  beforeEach(async function () {
    [owner, chair, voter1, voter2, voter3, ...addrs] = await ethers.getSigners();

    // token = await ethers.getContractAt("Token", tokenAddr);
    Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("Yena Token", "YEN");

    Dao = await ethers.getContractFactory("Dao");
    dao = await Dao.deploy(chair.address, token.address, 3, 600);
    await dao.deployed();

    recipient = token.address;

    // addr1 gets 100 teokens
    await token.transfer(voter1.address, 100);
    await token.transfer(voter2.address, 200);
    await token.transfer(voter3.address, 400);

    await token.connect(voter1).approve(dao.address, 500);
    await token.connect(voter3).approve(dao.address, 500);
  });

  describe("testcall", function () {
    it("Check if calldata works", async function () {
      await token.setDao(dao.address);

      await dao.callTest(recipient, calldata);
    });
  });

  describe("constructor", function () {
    it("Should set chairman", async function () {
      expect(await dao.chairman()).to.equal(chair.address);
    });
  });

  describe("setMinQuorum, setDebatePeriod", function () {
    it("Should let chairman change min quorum, debate period", async function () {
      await expect(dao.connect(chair).setMinQuorum(2)).to.not.be.reverted;
      await expect(dao.connect(chair).setDebatePeriod(200)).to.not.be.reverted;
    });
    it("Should not let non-chairman change min quorum, debate period", async function () {

      await expect(dao.connect(voter1).setMinQuorum(2))
      .to.be.revertedWith('Not the chairman');
      
      await expect(dao.connect(voter1).setDebatePeriod(200))
      .to.be.revertedWith('Not the chairman');
    });
  });

  
  describe("deposit", function () {
    it("Should let deposit tokens", async function () {
      await expect(dao.connect(voter1).deposit(50))
      .to.emit(token, 'Transfer')
      .withArgs(voter1.address, dao.address, 50);
      expect(await dao.deposits(voter1.address)).to.equal(50);
    });

    it("Should correctly deposit if deposit multiple times", async function () {
      await dao.connect(voter1).deposit(50);
      await dao.connect(voter1).deposit(50);
      expect(await dao.deposits(voter1.address)).to.equal(100);
    });

    it("Should emit deposit event", async function () {
      await expect(dao.connect(voter1).deposit(50))
        .to.emit(dao, 'Deposit')
        .withArgs(voter1.address, 50);
    });
  });

  describe("addProposal", function () {
    it("Should let chairman add proposal", async function () {
      await expect(dao.connect(chair).addProposal(calldata, recipient, "Lets increase the transfer fee!")).to.not.be.reverted;
    });

    it("Should not let non-chairman add proposal", async function () {
      await expect(dao.connect(voter1).addProposal(calldata, recipient, "Lets increase the transfer fee!"))
      .to.be.revertedWith('Not the chairman');
    });

    it("Should set proposal parameters correctly", async function () {
      await dao.connect(chair).addProposal(calldata, recipient, "Lets increase the transfer fee!");
      expect((await dao.proposals(1)).open).to.equal(true);
      expect((await dao.proposals(1)).callData).to.equal(calldata);
      expect((await dao.proposals(1)).recipient).to.equal(recipient);
    });

    it("Should emit addProposal event", async function () {
      // Get the block number
      ethers.provider.getBlockNumber().then(function (blockNumber) {

        // getBlock returns a block object and it has a timestamp property.
        ethers.provider.getBlock(blockNumber).then(async function (block) {

          const timestamp = block.timestamp;
          await expect(dao.connect(chair).addProposal(calldata, recipient, "Lets increase the transfer fee!"))
            .to.emit(dao, 'AddProposal')
            .withArgs(1, calldata, recipient, "Lets increase the transfer fee!", timestamp);
        })
      });
    });
  });

  describe("vote", function () {
    it("Should not let vote if no deposit", async function () {
      await dao.connect(chair).addProposal(calldata, recipient, "Lets increase the transfer fee!");
      await expect(dao.connect(voter1).vote(1, true)).to.be.revertedWith("No deposit for vote");
    });

    it("Should not let vote for non-existent proposal", async function () {
      await dao.connect(voter1).deposit(50);
      await expect(dao.connect(voter1).vote(1, true)).to.be.revertedWith("No such proposal");
    });

    it("Should not let vote twice", async function () {
      await dao.connect(voter1).deposit(50);
      await dao.connect(chair).addProposal(calldata, recipient, "Lets increase the transfer fee!");
      await dao.connect(voter1).vote(1, true);
      await expect(dao.connect(voter1).vote(1, true)).to.be.revertedWith("Already voted on this proposal");
    });

    it("Should not let vote on finished proposal", async function () {
      await dao.connect(chair).addProposal(calldata, recipient, "Lets increase the transfer fee!");
      await dao.connect(voter1).deposit(50);
      await dao.connect(voter1).vote(1, true);

      await ethers.provider.send("evm_increaseTime", [10000]);
      await ethers.provider.send("evm_mine", []);

      await dao.finishProposal(1);

      await dao.connect(voter3).deposit(50);

      await expect(dao.connect(voter3).vote(1, true)).to.be.revertedWith('Voting period finished');
    });

    it("Should let vote and set correct parameters", async function () {
      await dao.connect(voter1).deposit(50);
      await dao.connect(chair).addProposal(calldata, recipient, "Lets increase the transfer fee!");
      await expect(dao.connect(voter1).vote(1, true)).to.not.be.reverted;
    });

    it("Should emit vote event", async function () {
      await dao.connect(voter1).deposit(50);
      await dao.connect(chair).addProposal(calldata, recipient, "Lets increase the transfer fee!");

      await expect(dao.connect(voter1).vote(1, true))
        .to.emit(dao, 'Vote')
        .withArgs(voter1.address, 50, 1, true);
    });
  });

  describe("finishProposal", function () {

    it("Should not let finish non-existent proposal", async function () {
      await expect(dao.finishProposal(1)).to.be.revertedWith('No such proposal');
    });

    it("Should not let finish before specified period", async function () {
      await dao.connect(chair).addProposal(calldata, recipient, "Lets increase the transfer fee!");
      // emulate time passed, 72h = 259200sec
      await ethers.provider.send("evm_increaseTime", [100]);
      await ethers.provider.send("evm_mine", []);
      await expect(dao.connect(chair).finishProposal(1)).to.be.revertedWith('Voting period not finished yet');
    });

    it("Should not let finish twice", async function () {
      await dao.connect(chair).addProposal(calldata, recipient, "Lets increase the transfer fee!");
      await dao.connect(voter1).deposit(50);
      await dao.connect(voter1).vote(1, true);

      await ethers.provider.send("evm_increaseTime", [10000]);
      await ethers.provider.send("evm_mine", []);

      await dao.finishProposal(1);

      await expect(dao.finishProposal(1)).to.be.revertedWith('Voting finished already');
    });

    it("Should fail (emit fail event) if not enough quorum", async function () {
      await dao.connect(chair).addProposal(calldata, recipient, "Lets increase the transfer fee!");
      await dao.connect(voter1).deposit(1);
      await dao.connect(voter1).vote(1, true);

      await ethers.provider.send("evm_increaseTime", [10000]);
      await ethers.provider.send("evm_mine", []);

      await expect(dao.finishProposal(1))
        .to.emit(dao, 'ProposalFinished')
        .withArgs(1, false, 1, "Quorum is not present");
    });

    it("Should fail (emit fail event) if more voted against", async function () {
      await dao.connect(chair).addProposal(calldata, recipient, "Lets increase the transfer fee!");
      await dao.connect(voter1).deposit(50);
      await dao.connect(voter3).deposit(400);
      await dao.connect(voter1).vote(1, true);
      await dao.connect(voter3).vote(1, false);

      await ethers.provider.send("evm_increaseTime", [10000]);
      await ethers.provider.send("evm_mine", []);

      await expect(dao.finishProposal(1))
      .to.emit(dao, 'ProposalFinished')
      .withArgs(1, false, 450, "Quorum voted against");
    });

    it("Should emit fail event if calldata execution fails", async function () {
      await dao.connect(chair).addProposal(calldata, recipient, "Lets increase the transfer fee!");
      await dao.connect(voter1).deposit(50);
      await dao.connect(voter1).vote(1, true);

      await ethers.provider.send("evm_increaseTime", [10000]);
      await ethers.provider.send("evm_mine", []);

      await expect(dao.connect(voter1).finishProposal(1))
        .to.emit(dao, 'ProposalFinished')
        .withArgs(1, false, 50, "Call to contract failed");
    });

    it("Should emit success event if calldata execution succeeds", async function () {
      await dao.connect(chair).addProposal(calldata, recipient, "Lets increase the transfer fee!");
      await dao.connect(voter1).deposit(50);
      await dao.connect(voter1).vote(1, true);

      await ethers.provider.send("evm_increaseTime", [10000]);
      await ethers.provider.send("evm_mine", []);
      await token.setDao(dao.address);
      await expect(dao.finishProposal(1))
        .to.emit(dao, 'ProposalFinished')
        .withArgs(1, true, 50, "Quorum voted pro and call data executed");

      expect(await token.transferFee()).to.equal(newFee);
    });
  });

  describe("withdraw", function () {
    it("Should not let withdraw if proposal not finished", async function () {
      await dao.connect(chair).addProposal(calldata, recipient, "Lets increase the transfer fee!");
      await dao.connect(voter1).deposit(50);
      await dao.connect(voter1).vote(1, true);

      await ethers.provider.send("evm_increaseTime", [500]);
      await ethers.provider.send("evm_mine", []);

      await expect(dao.connect(voter1).withdraw())
      .to.be.revertedWith("Voting not finished yet, can't withdraw");
    });

    it("Should let withdraw if not voted", async function () {
      await dao.connect(voter1).deposit(50);
      await expect((await dao.connect(voter1).withdraw()).wait()).to.not.be.reverted;
    });

    it("Should let withdraw if proposal finished", async function () {
      await dao.connect(chair).addProposal(calldata, recipient, "Lets increase the transfer fee!");
      await dao.connect(voter1).deposit(50);
      await dao.connect(voter1).vote(1, true);

      await ethers.provider.send("evm_increaseTime", [10000]);
      await ethers.provider.send("evm_mine", []);

      await dao.finishProposal(1);
      await expect((await dao.connect(voter1).withdraw()).wait()).to.not.be.reverted;
    });

    it("Should not let withdraw if second proposal is not finished", async function () {
      await dao.connect(chair).addProposal(calldata, recipient, "Lets increase the transfer fee!");
      await dao.connect(voter1).deposit(50);
      await dao.connect(voter1).vote(1, true);

      await ethers.provider.send("evm_increaseTime", [50]);
      await ethers.provider.send("evm_mine", []);

      await dao.connect(chair).addProposal(calldata, recipient, "Lets increase the transfer fee again!");
      await dao.connect(voter1).vote(2, false);

      // first proposal finished, second is not
      await ethers.provider.send("evm_increaseTime", [550]);
      await ethers.provider.send("evm_mine", []);

      await dao.finishProposal(1);
      await expect(dao.connect(voter1).withdraw())
        .to.be.revertedWith("Voting not finished yet, can't withdraw");
    });

    it("Should emit withdraw event", async function () {
      await dao.connect(chair).addProposal(calldata, recipient, "Lets increase the transfer fee!");
      await dao.connect(voter1).deposit(50);
      await dao.connect(voter1).vote(1, true);

      await ethers.provider.send("evm_increaseTime", [10000]);
      await ethers.provider.send("evm_mine", []);

      await dao.finishProposal(1);
      await expect(dao.connect(voter1).withdraw())
        .to.emit(dao, 'Withdraw')
        .withArgs(voter1.address, 50);
    });
  });

});