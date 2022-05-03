import { task } from "hardhat/config";

const contractAddress = "0xD613f8824B02fd3D6Ca764cb7d98c527eeA24647";

task("vote", "Vote for proposal")
.addParam("proposalId", "Proposal ID")
.addParam("isSupport", "Bool value: for (true) or against (false)")
.setAction(async function ({ proposalId, isSupport }, { ethers }) {
    const Dao = await ethers.getContractAt("Dao", contractAddress);
    const transactionResponse = await Dao.vote(proposalId, isSupport, {
        gasLimit: 500_000,
    });
    console.log(`Transaction Hash: ${transactionResponse.hash}`);
});

task("addProposal", "Add new proposal")
.addParam("calldata", "Calldata that will be executed if proposal succeeds")
.addParam("recipient", "Contract address which to call")
.addParam("description", "Description of the proposal")
.setAction(async function ({ calldata, recipient, description }, { ethers }) {
    const Dao = await ethers.getContractAt("Dao", contractAddress);
    const transactionResponse = await Dao.addProposal(calldata, recipient, description, {
        gasLimit: 500_000,
    });
    console.log(`Transaction Hash: ${transactionResponse.hash}`);
});

task("finishProposal", "Finish proposal, evaluate results")
.addParam("proposalId", "Proposal ID")
.setAction(async function ({ proposalId }, { ethers }) {
    const Dao = await ethers.getContractAt("Dao", contractAddress);
    const transactionResponse = await Dao.finishProposal(proposalId, {
        gasLimit: 500_000,
    });
    console.log(`Transaction Hash: ${transactionResponse.hash}`);
});

task("deposit", "Deposit tokens to take part in the voting")
.addParam("amount", "Token amount")
.setAction(async function ({ amount }, { ethers }) {
    const Dao = await ethers.getContractAt("Dao", contractAddress);
    const transactionResponse = await Dao.deposit(amount, {
        gasLimit: 500_000,
    });
    console.log(`Transaction Hash: ${transactionResponse.hash}`);
});

task("setMinQuorum", "Set minimal quorum for the voting - owner only")
.addParam("amount", "Token amount for minimal quorum")
.setAction(async function ({ amount }, { ethers }) {
    const Dao = await ethers.getContractAt("Dao", contractAddress);
    const transactionResponse = await Dao.setMinQuorum(amount, {
        gasLimit: 500_000,
    });
    console.log(`Transaction Hash: ${transactionResponse.hash}`);
});

task("setDebatePeriod", "Set debate period for the voting - owner only")
.addParam("period", "Debate period for the voting in seconds")
.setAction(async function ({ period }, { ethers }) {
    const Dao = await ethers.getContractAt("Dao", contractAddress);
    const transactionResponse = await Dao.setDebatePeriod(period, {
        gasLimit: 500_000,
    });
    console.log(`Transaction Hash: ${transactionResponse.hash}`);
});