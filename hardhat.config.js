// Hardhat config (ESM)
import "dotenv/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";

const providerOpSepolia = process.env.PROVIDER_OP_SEPOLIA;
const providerMainnet = process.env.PROVIDER_MAINNET;
const providerBase = process.env.PROVIDER_BASE;
const providerBaseSepolia = process.env.PROVIDER_BASE_SEPOLIA;
const privateKey = process.env.PRIVATE_KEY;

export default {
  solidity: {
    version: "0.8.22",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    opSepolia: { type: "http", url: providerOpSepolia, accounts: privateKey ? [privateKey] : [] },
    mainnet: { type: "http", url: providerMainnet, accounts: privateKey ? [privateKey] : [] },
    base: { type: "http", url: providerBase, accounts: privateKey ? [privateKey] : [] },
    baseSepolia: { type: "http", url: providerBaseSepolia, accounts: privateKey ? [privateKey] : [] },
  },
  etherscan: {
    apiKey: "NO_API_KEY_NEEDED", // Blockscout on Base Sepolia doesn't require an API key
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://base-sepolia.blockscout.com/api",
          browserURL: "https://base-sepolia.blockscout.com",
        },
      },
    ],
  },
  verify: { blockscout: { enabled: false }, sourcify: { enabled: false } },
};
