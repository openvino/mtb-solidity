// contracts/Payout.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Payout is Ownable {
    constructor(address initialOwner) Ownable(initialOwner) {}

    receive() external payable {}

    function pay(address payable to) external payable onlyOwner {
        (bool ok, ) = to.call{value: msg.value}("");
        require(ok, "forward failed");
    }
}