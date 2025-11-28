// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice ERC20 estándar con supply inicial acuñado al deployer.
contract StandardERC20 is ERC20 {
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply // en unidades completas, se multiplica por 1e18
    ) ERC20(name_, symbol_) {
        _mint(msg.sender, initialSupply * 1e18);
    }
}
