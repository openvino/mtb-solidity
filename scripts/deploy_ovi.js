import "dotenv/config";
import { ethers } from "ethers";
import hre from "hardhat";
import fs from "fs";
import path from "path";
import readline from "readline";
import { findBuildInfo, writeVerifyFiles } from "./utils/verifyArtifacts.js";

const PROVIDER_URL = process.env.PROVIDER_BASE_SEPOLIA;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PROVIDER_URL) throw new Error("Missing PROVIDER_BASE_SEPOLIA in .env");
if (!PRIVATE_KEY) throw new Error("Missing PRIVATE_KEY in .env");

function makePrompt() {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	const ask = (question, def = "") =>
		new Promise((resolve) => {
			const suffix = def ? ` (${def})` : "";
			rl.question(`${question}${suffix}: `, (answer) =>
				resolve((answer || def || "").trim())
			);
		});
	const close = () => rl.close();
	return { ask, close };
}

function ensureAddress(value, label) {
	if (!ethers.isAddress(value))
		throw new Error(`${label} must be a valid address: ${value}`);
	return value;
}

async function main() {
	const { ask, close } = makePrompt();

	try {
		const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
		const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
		const net = await provider.getNetwork();

		const chainId = Number(net.chainId);
		const networkName = chainId === 84532 ? "baseSepolia" : "unknown";

		console.log("Network:", networkName, "chainId:", chainId.toString());
		console.log("Deployer:", wallet.address);

		const tokenName = await ask(
			"Token name (OVI)",
			process.env.DAO_TOKEN_NAME || "OVI"
		);
		const tokenSymbol = await ask(
			"Token symbol (OVI)",
			process.env.DAO_TOKEN_SYMBOL || "OVI"
		);

		const recipient = ensureAddress(
			await ask(
				"Initial recipient of full supply",
				process.env.DAO_TOKEN_RECIPIENT || wallet.address
			),
			"Initial recipient"
		);

		const defaultAdmin = ensureAddress(
			await ask(
				"DEFAULT_ADMIN_ROLE (controls oracle/roles)",
				process.env.DAO_TOKEN_ADMIN || wallet.address
			),
			"DEFAULT_ADMIN_ROLE"
		);

		const pauser = ensureAddress(
			await ask(
				"PAUSER_ROLE (can pause transfers)",
				process.env.DAO_TOKEN_PAUSER || wallet.address
			),
			"PAUSER_ROLE"
		);

		const rebaser = ensureAddress(
			await ask(
				"REBASER_ROLE (can call split)",
				process.env.DAO_TOKEN_REBASER || wallet.address
			),
			"REBASER_ROLE"
		);

		const artifact = await hre.artifacts.readArtifact("OpenvinoDao");
		const factory = new ethers.ContractFactory(
			artifact.abi,
			artifact.bytecode,
			wallet
		);

		console.log("Deploying OVI...");

		const ovi = await factory.deploy(
			tokenName,
			tokenSymbol,
			recipient,
			defaultAdmin,
			pauser,
			rebaser
		);

		const tx = ovi.deploymentTransaction();
		console.log("Tx:", tx?.hash);

		await ovi.waitForDeployment();
		const address = await ovi.getAddress();

		console.log("✅ OVI deployed at:", address);

		// === Save deployment JSON ===
		const deploymentsDir = path.join(process.cwd(), "deployments");
		fs.mkdirSync(deploymentsDir, { recursive: true });

		const constructorArgs = [
			tokenName,
			tokenSymbol,
			recipient,
			defaultAdmin,
			pauser,
			rebaser,
		];

		const abiEncodedArgs = ethers.AbiCoder.defaultAbiCoder().encode(
			["string", "string", "address", "address", "address", "address"],
			constructorArgs
		);

		const outPath = path.join(deploymentsDir, "ovi.json");

		fs.writeFileSync(
			outPath,
			JSON.stringify(
				{
					network: networkName,
					chainId: chainId.toString(),
					address,
					txHash: tx?.hash ?? "",
					constructorArgs,
					abiEncodedConstructorArgs: abiEncodedArgs,
				},
				null,
				2
			)
		);

		console.log("📁 Deployment data saved to:", outPath);

		// === Locate & save build-info (Hardhat artifacts API) + Standard JSON Input ===
		const chosen = findBuildInfo("contracts/OpenvinoDao.sol", "OpenvinoDao");
		const {
			baseDir: verifyDir,
			buildInfoFile,
			standardJsonInputFile,
		} = writeVerifyFiles({
			scriptLabel: "deploy_ovi",
			label: `ovi_${tokenSymbol}`,
			address,
			buildInfoData: chosen?.data,
		});
		const buildInfoSourcePath = chosen?.path || "";

		// === Generate verify helper ===
		const verifyCmd = `npx hardhat verify --network ${networkName} ${address} "${tokenName}" "${tokenSymbol}" ${recipient} ${defaultAdmin} ${pauser} ${rebaser} --contract contracts/OpenvinoDao.sol:OpenvinoDao`;

		const verifyFileName = `ovi_verify_${tokenSymbol}_${address}.json`;

		fs.writeFileSync(
			path.join(verifyDir, verifyFileName),
			JSON.stringify(
				{
					contract: "contracts/OpenvinoDao.sol:OpenvinoDao",
					address,
					network: networkName,
					chainId: chainId.toString(),
					constructorArgs,
					abiEncodedConstructorArgs: abiEncodedArgs,
					compiler: {
						type: "solc",
						version: "0.8.22",
						optimizer: { enabled: true, runs: 200 },
						evmVersion: "paris",
						license: "MIT",
					},
					verifyCmd,
					buildInfoFile,
					buildInfoSourcePath: buildInfoSourcePath || "not-found",
					standardJsonInput: standardJsonInputFile,
				},
				null,
				2
			)
		);

		console.log(
			"✅ Verify helper saved to deployments/verify/",
			verifyFileName
		);
		console.log("Manual verify command:\n", verifyCmd);

		// === Automatic Blockscout verification (best-effort, no API key needed) ===
		try {
			const BLOCKSCOUT_VERIFY_URL =
				process.env.BLOCKSCOUT_VERIFY_URL ||
				"https://base-sepolia.blockscout.com/api";

			if (
				networkName === "baseSepolia" &&
				standardJsonInputFile !== "not-found"
			) {
				const standardJsonPath = path.join(verifyDir, standardJsonInputFile);
				const standardJson = fs.readFileSync(standardJsonPath, "utf8");

				const params = new URLSearchParams();
				params.set("module", "contract");
				params.set("action", "verifysourcecode");
				params.set("contractaddress", address);
				params.set("codeformat", "solidity-standard-json-input");
				params.set("sourceCode", standardJson);
				params.set("contractname", "contracts/OpenvinoDao.sol:OpenvinoDao");
				params.set("compilerversion", "v0.8.22+commit.4fc1097e");
				params.set("optimizationUsed", "1");
				params.set("runs", "200");
				params.set("licenseType", "MIT");
				params.set("evmVersion", "paris");
				params.set("constructorArguments", abiEncodedArgs.replace(/^0x/, ""));

				let attempt = 0;
				let done = false;
				while (!done && attempt < 5) {
					attempt++;
					const res = await fetch(BLOCKSCOUT_VERIFY_URL, {
						method: "POST",
						headers: { "Content-Type": "application/x-www-form-urlencoded" },
						body: params,
					});
					let data;
					try {
						data = await res.json();
					} catch (_) {
						data = { status: "0", message: "invalid JSON from Blockscout" };
					}
					console.log(`🔍 Blockscout attempt ${attempt}:`, data);
					if (data?.status === "1") {
						done = true;
						break;
					}
					// If Blockscout says not a contract, wait and retry (indexing lag)
					if (
						(data?.message || "")
							.toLowerCase()
							.includes("address is not a smart-contract") ||
						(data?.message || "")
							.toLowerCase()
							.includes("missing sourcecode") ||
						(data?.message || "").toLowerCase().includes("missing codeformat")
					) {
						await new Promise((r) => setTimeout(r, 7000));
						continue;
					}
					// Other errors: break
					done = true;
				}
			} else {
				console.warn(
					"Skipping Blockscout verify: not baseSepolia or no standard JSON input"
				);
			}
		} catch (err) {
			console.warn("Blockscout auto-verify failed:", err.message);
		}
	} finally {
		close();
	}
}

main().catch((err) => {
	console.error("❌ Deployment error:", err);
	process.exitCode = 1;
});
