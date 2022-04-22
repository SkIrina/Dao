//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./IToken.sol";

contract Dao {
    IToken public token;
    uint256 private _minQuorum;
    uint256 private _debatingDuration;
    address public chairman;
    mapping(address => uint) public deposits;
    mapping(uint => Proposal) public proposals;
    mapping (address => uint[]) public votingRegister;
    uint private currentProposalId;

    struct Proposal {
        uint startedTime;
        bool open;
        string description;
        address recipient;
        uint votedYes;
        uint votedNo;
        bytes callData;
        mapping (address => bool) voters;
    }

    event ProposalFinished(uint proposalID, bool result, uint quorum, string comment);

    modifier onlyChairman {
        require(msg.sender == chairman, "Not the chairman");
        _;
    }

    constructor(address chairPerson, address _voteToken, uint256 _minimumQuorum, uint256 _debatingPeriodDuration) {
        chairman = chairPerson;
        token = IToken(_voteToken);
        _minQuorum = _minimumQuorum;
        _debatingDuration = _debatingPeriodDuration;
    }

    function setMinQuorum(uint newMinQuorum) public onlyChairman {
        _minQuorum = newMinQuorum;
    }

    function setDebatePeriod(uint newDebatePeriod) public onlyChairman {
        _debatingDuration = newDebatePeriod;
    }

    function deposit(uint amount) public {
        deposits[msg.sender] += amount;
        token.transferFrom(msg.sender, address(this), amount);
    }

    function withdraw() public {
        require(deposits[msg.sender] > 0, "No deposit to withdraw");
        bool result = false;
        for (uint i = 0; i < votingRegister[msg.sender].length; i++) {
            Proposal storage p = proposals[votingRegister[msg.sender][i]];
            result = result || p.open;
        }
        if (!result) {
            token.transfer(msg.sender, deposits[msg.sender]);
        }
    }

    function addProposal(bytes memory callData, address _recipient, string memory description) public onlyChairman returns (uint256){
        currentProposalId++;
        Proposal storage p = proposals[currentProposalId];
        p.callData = callData;
        p.startedTime = block.timestamp;
        p.open = true;
        p.description = description;
        p.recipient = _recipient;
        return currentProposalId;
    }

    function vote(uint _proposalID, bool isSupport) public {
        require(deposits[msg.sender] > 0, "No deposit for vote");
        require(proposals[_proposalID].startedTime > 0, "No such proposal");
        require(proposals[_proposalID].voters[msg.sender] == false, "Already voted on this proposal");
        require(proposals[_proposalID].open, "Voting period finished");
    
        uint votes = deposits[msg.sender];
        if (isSupport) {
            proposals[_proposalID].votedYes += votes;
        } else {
            proposals[_proposalID].votedNo += votes;
        }
        proposals[_proposalID].voters[msg.sender] = true;
        votingRegister[msg.sender].push(_proposalID);
    }

    function finishProposal(uint _proposalID) public {
        require(proposals[_proposalID].startedTime > 0, "No such proposal");
        require(proposals[_proposalID].startedTime + _debatingDuration < block.timestamp, "Voting period not finished yet");
        require(proposals[_proposalID].open, "Voting finished already");
    
        proposals[_proposalID].open = false;
        uint quorum = proposals[_proposalID].votedNo + proposals[_proposalID].votedYes;

        if (quorum < _minQuorum) {
            emit ProposalFinished(_proposalID, false, quorum, "Quorum is not present");
            return;
        }
        if (proposals[_proposalID].votedNo > proposals[_proposalID].votedYes) {
            emit ProposalFinished(_proposalID, false, quorum, "Quorum voted against");
            return;
        }

        if (callTest(proposals[_proposalID].recipient, proposals[_proposalID].callData) == true) {
            emit ProposalFinished(_proposalID, true, quorum, "Quorum voted pro and call data executed");
        } else {
            emit ProposalFinished(_proposalID, false, quorum, "Call to contract failed");
        }
        return;
    }

    function callTest(address recipient, bytes memory signature) public returns (bool) {   
        (bool success, ) = recipient.call{value: 0} (
            signature
        );
        return success;
    }

}
