// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev Test helper that mimics a rebasing token by adjusting balances for selected accounts.
 *      This is exclusively used inside Hardhat tests.
 */
contract MockRebasingToken is ERC20, Ownable {
    constructor(string memory name, string memory symbol)
        ERC20(name, symbol)
        Ownable(msg.sender)
    {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Multiplies balances of the provided accounts by `numerator/denominator`.
     *      Used to simulate a split without touching unrelated holders.
     */
    function split(address[] calldata accounts, uint256 numerator, uint256 denominator)
        external
        onlyOwner
    {
        require(denominator != 0, "denominator zero");
        require(numerator != 0, "numerator zero");

        for (uint256 i = 0; i < accounts.length; i++) {
            address account = accounts[i];
            uint256 balance = balanceOf(account);
            if (balance == 0) continue;

            uint256 newBalance = (balance * numerator) / denominator;
            if (newBalance > balance) {
                _mint(account, newBalance - balance);
            } else if (balance > newBalance) {
                _burn(account, balance - newBalance);
            }
        }
    }
}
