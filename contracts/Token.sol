// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    uint256 public transferFee;
    address private DAO;
    address public owner;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 100 * 10**uint(decimals()));
        owner = msg.sender;
        transferFee = 3;
    }

    modifier onlyDAO {
        require(msg.sender == DAO, "Not authorised");
        _;
    }

    modifier onlyOwner {
        require(msg.sender == owner, "Not authorised");
        _;
    }

    function changeFee(uint256 newPercent) public onlyDAO {
        transferFee = newPercent;
    }

    function setDao(address _dao) public onlyOwner {
        DAO = _dao;
    }
}