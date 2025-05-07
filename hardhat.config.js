require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

const providerOpSepolia = process.env.PROVIDER_OP_SEPOLIA;
const providerMainnet = process.env.PROVIDER_MAINNET;
const providerBase = process.env.PROVIDER_BASE;
const providerBaseSepolia = process.env.PROVIDER_BASE_SEPOLIA;
const privateKey = process.env.PRIVATE_KEY;

module.exports = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    optimismSepolia: {
      url: providerOpSepolia,
      accounts: [privateKey],
    },
    mainnet: {
      url: providerMainnet,
      accounts: [privateKey],
    },
    base: {
      url: providerBase,
      accounts: [privateKey],
    },
    baseSepolia: {
      url: providerBaseSepolia,
      accounts: [privateKey],
    },
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      sepolia: process.env.ETHERSCAN_API_KEY,
      base: process.env.BASESCAN_API_KEY,
      baseSepolia: process.env.BASESCAN_API_KEY,
    },
  },
};
