// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/governance/TimelockController.sol";

contract MyTimelock is TimelockController {
    constructor(
        uint256 minDelay,                // Tiempo mínimo de espera
        address[] memory proposers,     // Direcciones que pueden proponer
        address[] memory executors,     // Direcciones que pueden ejecutar
        address admin                   // Admin inicial del contrato
    )
        TimelockController(minDelay, proposers, executors, admin)
    {}
}
