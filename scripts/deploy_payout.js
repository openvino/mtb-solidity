// scripts/deploy_payout.js
// Hardhat 3 + ethers v6 (ESM)
import hre from "hardhat";
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import "dotenv/config";

const require = createRequire(import.meta.url);
const { findBuildInfo, writeVerifyFiles } = require("./utils/verifyArtifacts.cjs");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function prompt() {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	const ask = (q, d = "") =>
		new Promise((res) => rl.question(`${q}${d ? ` (${d})` : ""}: `, (ans) => res((ans || d).trim())));
	const close = () => rl.close();
	return { ask, close };
}

async function main() {
	const { ethers } = await hre.network.connect();
	const { ask, close } = prompt();
	let timelock = process.env.PAYOUT_OWNER || process.env.TIMELOCK_ADDRESS || "";
	try {
		timelock = await ask("Payout owner (timelock)", timelock);
		if (!timelock) {
			throw new Error("Missing Payout owner address");
		}

		const Payout = await ethers.getContractFactory("Payout");
		const payout = await Payout.deploy(timelock);
		await payout.waitForDeployment();
		const addr = await payout.getAddress();

		console.log("Payout deployed at:", addr);

		// Optional verification (skip if SKIP_VERIFICATION=true)
		if (process.env.SKIP_VERIFICATION !== "true") {
			try {
				const argsDir = path.join(__dirname, "../deployments/verify/args");
				fs.mkdirSync(argsDir, { recursive: true });
				const argsPath = path.join(argsDir, `constructor_args_${addr}.js`);
				fs.writeFileSync(
					argsPath,
					`export default ${JSON.stringify([timelock], null, 2)};\n`
				);
				const relativeArgsPath = path.relative(process.cwd(), argsPath);
				const task = hre.tasks.getTask("verify");
				await task.run({
					address: addr,
					constructorArgsPath: relativeArgsPath,
					contract: "contracts/Payout.sol:Payout",
				});
				console.log("Verified OK");
			} catch (e) {
				console.log("Verify skipped/failed:", e?.message ?? e);
			}
		}

		const bi = findBuildInfo("contracts/Payout.sol", "Payout");
		if (bi?.data) {
			writeVerifyFiles({
				scriptLabel: "deploy_payout",
				label: "payout",
				address: addr,
				buildInfoData: bi.data,
			});
		}
	} finally {
		close();
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
