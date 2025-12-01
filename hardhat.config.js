// hardhat.config.js — Hardhat 3 + Verify V2
import "dotenv/config";
import { defineConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import hardhatVerify from "@nomicfoundation/hardhat-verify";

const {
	PROVIDER_OP_SEPOLIA,
	PROVIDER_MAINNET,
	PROVIDER_BASE,
	PROVIDER_BASE_SEPOLIA,
	PRIVATE_KEY,
	ETHERSCAN_API_KEY,
} = process.env;

export default defineConfig({
	solidity: {
		version: "0.8.22",
		settings: { optimizer: { enabled: true, runs: 200 } },
	},

	networks: {
		opSepolia: {
			type: "http",
			url: PROVIDER_OP_SEPOLIA,
			accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
		},
		mainnet: {
			type: "http",
			url: PROVIDER_MAINNET,
			accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
		},
		base: {
			type: "http",
			url: PROVIDER_BASE,
			accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
		},
		baseSepolia: {
			type: "http",
			url: PROVIDER_BASE_SEPOLIA,
			accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
		},
	},

	// 👇 ESTO es lo que faltaba: registrar el plugin
	plugins: [hardhatVerify],

	// Config de verificación V2 (una sola API key)
	verify: {
		etherscan: {
			apiKey: ETHERSCAN_API_KEY,
		},
		blockscout: { enabled: true },
		sourcify: { enabled: true },
	},
});
