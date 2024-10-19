// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Capped.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract MTB is ERC20, ERC20Burnable, ERC20Pausable, ERC20Capped, AccessControl {
    bytes32 internal constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(
        string memory name, 
        string memory symbol, 
        uint256 cap
    ) 
        ERC20(name, symbol)
        ERC20Capped(cap)
        public
    {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender); 
    }

   
    function mint(address to, uint256 amount) public {
        require(hasRole(MINTER_ROLE, msg.sender), "Caller is not a minter");
        _mint(to, amount);
    }

 
    function addMinter(address account) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not an admin");
        grantRole(MINTER_ROLE, account);
    }

 
    function removeMinter(address account) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not an admin");
        revokeRole(MINTER_ROLE, account);
    }

   
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override(ERC20, ERC20Pausable, ERC20Capped) {
        super._beforeTokenTransfer(from, to, amount); 
    }

    
    function _mint(address account, uint256 amount) internal override(ERC20) {
        super._mint(account, amount);
    }
}
