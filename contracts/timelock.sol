// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/governance/TimelockController.sol";

contract MyTimelock is TimelockController {
    constructor(
        uint256 minDelay,                // Minimum waiting time
        address[] memory proposers,     // Addresses allowed to propose
        address[] memory executors,     // Addresses allowed to execute
        address admin                   // Initial admin of the contract
    )
        TimelockController(minDelay, proposers, executors, admin)
    {}
}
