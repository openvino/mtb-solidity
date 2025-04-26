// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MTB is ERC20, ERC20Burnable, ERC20Capped, ERC20Pausable, Ownable {
    constructor(
        string memory name, 
        string memory symbol, 
        uint256 cap
    ) 
        ERC20(name, symbol)
        ERC20Capped(cap)
        public
    {
       
    }
    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount); // Esta función la usarás desde un script
    }
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override(ERC20, ERC20Capped, ERC20Pausable) {
        super._beforeTokenTransfer(from, to, amount); 
    }
    function _mint(address account, uint256 amount) internal override(ERC20) {
        super._mint(account, amount);
    }
}
