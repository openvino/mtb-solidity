require("@nomicfoundation/hardhat-toolbox");
/** @type import('hardhat/config').HardhatUserConfig */

require("dotenv").config();
const provider = process.env.PROVIDER;
const providerMainnet = process.env.PROVIDER_MAINNET;
const providerBase = process.env.PROVIDER_BASE;
const providerBaseSepolia = process.env.PROVIDER_BASE_SEPOLIA;
const providerSepolia = process.env.PROVIDER_SEPOLIA;

const privateKey = process.env.PRIVATE_KEY;
module.exports = {
  solidity: {
    version: "0.6.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
		targetNetwork: {
			url: provider,
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

		sepolia: {
			url: providerSepolia,
			accounts: [privateKey],
			
		},
	},
};
