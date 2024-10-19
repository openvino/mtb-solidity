require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
require("dotenv").config();
const provider = process.env.PROVIDER;
const providerMainnet = process.env.PROVIDER_MAINNET;
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
	},
};
