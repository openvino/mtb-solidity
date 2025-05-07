// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Capped} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MTB is 
    ERC20, 
    ERC20Burnable, 
    ERC20Pausable, 
    ERC20Permit, 
    ERC20Capped, 
    Ownable 
{
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 cap_,
        uint256 initialMintAmount_
    )
        ERC20(name_, symbol_)
        ERC20Capped(cap_)
        ERC20Permit(name_)
        Ownable(msg.sender)
    {
        require(cap_ >= initialMintAmount_, "Cap menor que mint inicial");
        _mint(msg.sender, initialMintAmount_);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount); 
    }

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable, ERC20Capped)
    {
        super._update(from, to, value);
    }
}
