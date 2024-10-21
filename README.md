# OpenVino MTB* token Migration tool

## Overview

This migration tool contains the smart contracts for migration OpenVino wine tokens from the Costaflores winery (MTB*). These are ERC-20 tokens specifically designed for the OpenVino ecosystem. These tokens represent bottles of wine within the OpenVinoDAO wine community, facilitating activities such as buying, selling, and redeeming users with a digital representation of wine-related assets.

This project is part of the broader OpenVinoDAO initiative, merging decentralized technology with the wine industry.

## Key Features

- **ERC-20 Wine Tokens**: Implements a fungible token that represents value in the OpenVino wine ecosystem.
- **Minting Functionality**: Allows authorized users to mint new MTB tokens.
- **Custom Permissions**: Implements role-based access controls to ensure only authorized accounts can mint or manage the tokens.
- **Gas Efficiency**: Optimized for efficient on-chain transactions.
- **Upgradeable Contracts**: Uses Solidity's upgradeable proxy pattern to allow future improvements without disrupting the current system.

## Installation

To set up and run the MTB Solidity project, follow these instructions:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/openvino/mtb-solidity.git
   cd mtb-solidity
   ```

2. **Install Dependencies**:
   Install the necessary dependencies by running:
   ```bash
   npm install
   ```

3. **Compile Contracts**:
   Use `hardhat` to compile the smart contracts:
   ```bash
   npx hardhat compile
   ```

4. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add the necessary environment variables. These will include your private key and the provider for the desired Ethereum network. Additionally, you'll need to provide the token minter address.

   Example `.env` configuration:
   ```bash
   # Private key of the deployer account
   PRIVATE_KEY=<your_private_key>
   
   # Sepolia Network Provider
   PROVIDER_BASE_SEPOLIA=<your_sepolia_provider_url>
   
   # Base Network Provider
   PROVIDER_BASE=<your_base_provider_url>
   
   # OP Sepolia Network Provider
   PROVIDER=<your_op_sepolia_provider_url>
   
   # Mainnet Provider
   PROVIDER_MAINNET=<your_mainnet_provider_url>
   
   # Token Minter Address
   TOKEN_MINTER=<deployed_minter_address>
   ```

## Usage

### Minting Mike Tango Bravo (MTB) Tokens

To mint new MTB tokens, the `MTB.sol` contract exposes a function `mint(address recipient, uint256 amount)`. Authorized accounts can use this function to mint new ERC-20 tokens.

Example:
```javascript
const MTB = await ethers.getContractFactory("MTB");
await MTB.mint("0xRecipientAddress", amount);
```

### Transfer MTB Tokens

MTB tokens are fully ERC-20 compliant and can be transferred between Ethereum addresses using standard ERC-20 transfer functions.

Example:
```javascript
await MTB.transfer("0xRecipientAddress", amount);
```

### Role-Based Access Control

The smart contracts implement access control, ensuring only users with the appropriate permissions can mint tokens or perform administrative actions. Roles can be granted using the `grantRole()` function.

```javascript
await MTB.grantRole(role, "0xUserAddress");
```

### Upgradeable Contracts

The MTB contracts are upgradeable using the OpenZeppelin proxy pattern. This ensures that future improvements can be implemented without requiring a full redeployment of the token or a loss of data.

To upgrade a contract:
1. Deploy a new version of the contract.
2. Use the `upgradeTo()` function on the proxy to point it to the new contract implementation.

## Deployment

### Before Deploying: Deploy the Minter

Before deploying the Mike Tango Bravo (MTB) contracts, you need to deploy the token Minter contract. Once the Minter contract is deployed, its address will be used as part of the environment configuration.

1. **Install dependencies**:
   Ensure all dependencies are installed:
   ```bash
   npm install
   ```

2. **Compile the contracts**:
   Compile the smart contracts:
   ```bash
   npx hardhat compile
   ```

3. **Deploy with the Minter**:
   With the `.env` file set up, deploy the contracts using the Minter:
   ```bash
   npx hardhat run "scripts/deployWithMinter.js" --network targetNetwork
   ```

   Replace `targetNetwork` with the appropriate network identifier (e.g., `mainnet`, `sepolia`, etc.).

## Testing

To run tests for the MTB contracts, execute:
```bash
npx hardhat test
```

These tests will verify the functionality of the minting, token transfers, and role-based access control mechanisms.

## Upgrade Procedure

To upgrade the contract:

1. Modify the necessary logic in the contract source files located in the `contracts/` directory.
2. Deploy the new version of the contract using:
   ```bash
   npx hardhat run scripts/deployUpgrade.js --network <network>
   ```
3. This script will point the proxy contract to the new implementation, maintaining state continuity.

## Contribution

We welcome contributions to the Mike Tango Bravo Solidity project. If you would like to contribute:

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Write tests for your changes.
4. Submit a pull request for review.

Please ensure that your contributions adhere to the project’s coding standards and are accompanied by relevant tests.

## License

This project is licensed under the MIT License. For more information, see the `LICENSE` file.

---

## Contact

For support or more information about the OpenVino Mike Tango Bravo (MTB) Solidity project, contact the OpenVinoDAO team at [info@openvino.org](mailto:info@openvino.org).

---
