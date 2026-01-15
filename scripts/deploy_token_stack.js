import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import "dotenv/config";

const require = createRequire(import.meta.url);
const { findBuildInfo, writeVerifyFiles } = require("./utils/verifyArtifacts.cjs");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyOrLog({ address, constructorArguments = [], contract }) {
	if (process.env.SKIP_VERIFICATION === "true") {
		console.log(`Skipping verification for ${address}`);
		return;
	}
	try {
		const task = hre.tasks.getTask("verify");
		await task.run({ address, constructorArgs: constructorArguments, contract });
		console.log(`Verified: ${address}`);
	} catch (err) {
		console.warn(`Verification failed (${address}):`, err?.message || err);
	}
}

async function main() {
	const { ethers } = await hre.network.connect();
	const [deployer] = await ethers.getSigners();
	console.log("Deployer:", deployer.address);

	const tokenName = process.env.DAO_TOKEN_NAME || "OVI";
	const tokenSymbol = process.env.DAO_TOKEN_SYMBOL || "OVI";
	const recipient = process.env.DAO_TOKEN_RECIPIENT || deployer.address;
	const admin = process.env.DAO_TOKEN_ADMIN || deployer.address;
	const pauser = process.env.DAO_TOKEN_PAUSER || deployer.address;
	const rebaser = process.env.DAO_TOKEN_REBASER || deployer.address; // timelock in prod

	console.log("\nDeploying OpenvinoDao (rebasing token)...");
	const Dao = await ethers.getContractFactory("OpenvinoDao");
	const dao = await Dao.deploy(tokenName, tokenSymbol, recipient, admin, pauser, rebaser);
	await dao.waitForDeployment();
	const daoAddress = await dao.getAddress();
	console.log("DAO token deployed at:", daoAddress);

	await verifyOrLog({
		address: daoAddress,
		constructorArguments: [tokenName, tokenSymbol, recipient, admin, pauser, rebaser],
		contract: "contracts/OpenvinoDao.sol:OpenvinoDao",
	});

	const shareName = process.env.VAULT_SHARE_NAME || "Governance OpenVinoDAO";
	const shareSymbol = process.env.VAULT_SHARE_SYMBOL || "gOVI";

	console.log("\nDeploying OpenVinoTokenVault (wTOKEN)...");
	const Vault = await ethers.getContractFactory("OpenVinoTokenVault");
	const vault = await Vault.deploy(daoAddress, shareName, shareSymbol);
	await vault.waitForDeployment();
	const vaultAddress = await vault.getAddress();
	console.log("Vault deployed at:", vaultAddress);

	await verifyOrLog({
		address: vaultAddress,
		constructorArguments: [daoAddress, shareName, shareSymbol],
		contract: "contracts/vault/OpenVinoTokenVault.sol:OpenVinoTokenVault",
	});

	const biDao = findBuildInfo("contracts/OpenvinoDao.sol", "OpenvinoDao");
	writeVerifyFiles({
		scriptLabel: "deploy_token_stack",
		label: "dao",
		address: daoAddress,
		buildInfoData: biDao?.data,
	});
	const biVault = findBuildInfo("contracts/vault/OpenVinoTokenVault.sol", "OpenVinoTokenVault");
	writeVerifyFiles({
		scriptLabel: "deploy_token_stack",
		label: "vault",
		address: vaultAddress,
		buildInfoData: biVault?.data,
	});

	const record = {
		daoToken: daoAddress,
		vault: vaultAddress,
		recipient,
		admin,
		pauser,
		rebaser,
		shareName,
		shareSymbol,
		tokenName,
		tokenSymbol,
		network: await ethers.provider.getNetwork().then((n) => ({
			name: n.name,
			chainId: Number(n.chainId),
		})),
		deployer: deployer.address,
		timestamp: new Date().toISOString(),
	};

	const outputPath = path.join(__dirname, "../deployments/token-stack.json");
	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	fs.writeFileSync(outputPath, JSON.stringify(record, null, 2));
	console.log("\n📁 Token + Vault addresses saved to:", outputPath);
}

main().catch((err) => {
	console.error("Deployment error:", err);
	process.exit(1);
});
