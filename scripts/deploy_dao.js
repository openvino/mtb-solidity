import hardhat from "hardhat";
const { ethers, network, artifacts, run } = hardhat;
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import "dotenv/config";
import { findBuildInfo, writeVerifyFiles } from "./utils/verifyArtifacts.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

const counterPath = path.join(__dirname, "../deployments/deploy_counter.json");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadCounter() {
	try {
		const raw = fs.readFileSync(counterPath, "utf8");
		const parsed = JSON.parse(raw);
		if (typeof parsed.next === "number" && parsed.next > 0) {
			return Math.max(parsed.next, 5); // ensure we never go below 5
		}
	} catch (_) {}
	// Default starting point; last used 0004, so start at 0005
	return 5;
}

function saveCounter(next) {
	fs.mkdirSync(path.dirname(counterPath), { recursive: true });
	fs.writeFileSync(counterPath, JSON.stringify({ next }, null, 2));
}

function createPrompter() {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	const ask = (question, defaultValue = "") =>
		new Promise((resolve) => {
			const suffix = defaultValue ? ` (${defaultValue})` : "";
			rl.question(`${question}${suffix}: `, (answer) => resolve((answer || defaultValue || "").trim()));
		});
	return { ask, close: () => rl.close() };
}

function parseAddressList(input, fallback = []) {
	const source = (input || "").trim();
	if (!source) return fallback;
	return source
		.split(",")
		.map((addr) => addr.trim())
		.filter(Boolean);
}

async function verifyOrLog({ address, constructorArguments = [], contract, shouldVerify }) {
	if (!shouldVerify) {
		console.log("--> Skipping verification.");
		return;
	}

	// Add a delay here to give the explorer time to index the contract
	console.log("Waiting 15 seconds before attempting verification...");
	await sleep(15000);

	try {
		await run("verify:verify", {
			address,
			constructorArguments,
			contract,
		});
		console.log("✅ Verified on explorer.");
	} catch (err) {
		console.error("❌ Verification failed (this is not a fatal error):", err);
	}
}

async function main() {
	const prompt = createPrompter();
	const currentSequence = loadCounter();
	const nextReserved = currentSequence + 1;
	saveCounter(nextReserved); // increment up front to avoid reusing in case of partial/failing deploy
	const padSeq = (n) => n.toString().padStart(4, "0");
	const seqLabel = padSeq(currentSequence);

	try {
		const [signer] = await ethers.getSigners();
		const deployerAddress = await signer.getAddress();
		const zeroAddress = ethers.ZeroAddress;

		console.log(
			`Counter file: ${counterPath} | seq: ${seqLabel} (current=${currentSequence} reserved=${nextReserved})`
		);
		console.log(`Network: ${network.name}`);
		console.log("Deployer:", deployerAddress);

		const shouldVerify = (await prompt.ask("Attempt contract verification on explorer? (y/N)", "n")).toLowerCase() === 'y';

		// --- Prompt core params ---
		const defaultTokenName = `OVI_TEST_${seqLabel}`;
		const defaultTokenSymbol = `OVI_${seqLabel}`;
		const defaultShareName = `Wrapped Openvino ${seqLabel}`;
		const defaultShareSymbol = `wOVI_${seqLabel}`;

		const tokenName = await prompt.ask("Nombre del token DAO", defaultTokenName);
		const tokenSymbol = await prompt.ask("Símbolo del token DAO", defaultTokenSymbol);
		const shareName = await prompt.ask("Nombre del token de votos (wOVI)", defaultShareName);
		const shareSymbol = await prompt.ask("Símbolo del token de votos (wOVI)", defaultShareSymbol);

		const minDelay = Number(await prompt.ask("Timelock minDelay (segundos)", process.env.TIMELOCK_MIN_DELAY || "60"));
		const proposers = parseAddressList(
			await prompt.ask("Timelock proposers (coma separada)", process.env.TIMELOCK_PROPOSERS || deployerAddress),
			[deployerAddress]
		);
		const executorsInput = await prompt.ask(
			"Timelock executors (coma separada, 0x000...0 permite a cualquiera)",
			process.env.TIMELOCK_EXECUTORS || deployerAddress
		);
		let executors;
		const execTrim = executorsInput.trim().toLowerCase();
		if (!execTrim) {
			executors = [deployerAddress];
		} else if (execTrim === "0" || execTrim === zeroAddress.toLowerCase()) {
			executors = [zeroAddress];
		} else {
			executors = parseAddressList(executorsInput, [deployerAddress]);
		}
		const admin = await prompt.ask("Timelock admin", process.env.TIMELOCK_ADMIN || deployerAddress);

		console.log("\nDeploying Timelock...");
		const Timelock = await ethers.getContractFactory("OpenvinoTimelock", signer);
		const timelock = await Timelock.deploy(minDelay, proposers, executors, admin);
		const timelockAddress = await timelock.getAddress();
		console.log("Timelock deployed at:", timelockAddress);

		await verifyOrLog({
			address: timelockAddress,
			constructorArguments: [minDelay, proposers, executors, admin],
			contract: "contracts/timelock.sol:OpenvinoTimelock",
			shouldVerify,
		});

		let dao;
		const existingDaoEnv = process.env.DAO_TOKEN_ADDRESS;
		let daoAddress = await prompt.ask("Usar OVI existente? (deja vacío para desplegar uno nuevo)", existingDaoEnv || "");
		let voteTokenAddress = await prompt.ask(
			"Usar wOVI existente? (deja vacío para desplegar uno nuevo)",
			process.env.VOTE_TOKEN_ADDRESS || process.env.VAULT_ADDRESS || ""
		);

		if (daoAddress) {
			console.log("\nUsing existing DAO token at:", daoAddress);
			dao = await ethers.getContractAt("OpenvinoDao", daoAddress, signer);
		} else {
			const recipient = await prompt.ask("OVI recipient inicial", process.env.DAO_TOKEN_RECIPIENT || deployerAddress);
			const defaultAdmin = await prompt.ask("OVI admin por defecto", process.env.DAO_TOKEN_ADMIN || deployerAddress);
			const pauser = await prompt.ask("OVI pauser", process.env.DAO_TOKEN_PAUSER || deployerAddress);
			const rebaser = await prompt.ask("OVI rebaser", process.env.DAO_TOKEN_REBASER || timelockAddress);

			console.log("\nDeploying DAO Token (OVI)...");
			const Dao = await ethers.getContractFactory("OpenvinoDao", signer);
			dao = await Dao.deploy(tokenName, tokenSymbol, recipient, defaultAdmin, pauser, rebaser);
			daoAddress = await dao.getAddress();
			console.log("DAO Token deployed at:", daoAddress);

			await verifyOrLog({
				address: daoAddress,
				constructorArguments: [tokenName, tokenSymbol, recipient, defaultAdmin, pauser, rebaser],
				contract: "contracts/OpenvinoDao.sol:OpenvinoDao",
				shouldVerify,
			});
		}

		let voteToken;
		if (!voteTokenAddress) {
			console.log("\nDeploying OpenVinoTokenVault (wTOKEN votes)...");
			const Vault = await ethers.getContractFactory("OpenVinoTokenVault", signer);
			voteToken = await Vault.deploy(daoAddress, shareName, shareSymbol);
			voteTokenAddress = await voteToken.getAddress();
			console.log("Vault deployed at:", voteTokenAddress);

			await verifyOrLog({
				address: voteTokenAddress,
				constructorArguments: [daoAddress, shareName, shareSymbol],
				contract: "contracts/vault/OpenVinoTokenVault.sol:OpenVinoTokenVault",
				shouldVerify,
			});
		} else {
			console.log("\nUsing existing votes token (expected wOVI) at:", voteTokenAddress);
			voteToken = await ethers.getContractAt("OpenVinoTokenVault", voteTokenAddress, signer);
		}

		const delegateTx = await voteToken.delegate(deployerAddress);
		await delegateTx.wait();
		console.log("Delegated voting power on votes token to:", deployerAddress);

		const rebaserRole = await dao.REBASER_ROLE();
		const timelockHasRebaser = await dao.hasRole(rebaserRole, timelockAddress);
		if (!timelockHasRebaser) {
			const grantTx = await dao.grantRole(rebaserRole, timelockAddress);
			await grantTx.wait();
			console.log("Granted REBASER_ROLE to timelock");
		} else {
			console.log("Timelock already has REBASER_ROLE");
		}

		if (process.env.REVOKE_DEPLOYER_REBASER === "true") {
			const hasDeployerRole = await dao.hasRole(rebaserRole, deployerAddress);
			if (hasDeployerRole) {
				const revokeTx = await dao.revokeRole(rebaserRole, deployerAddress);
				await revokeTx.wait();
				console.log("Revoked REBASER_ROLE from deployer");
			}
		}

		console.log("\nDeploying Governor...");
		const Governor = await ethers.getContractFactory("OpenvinoGovernor", signer);
		const governor = await Governor.deploy(voteTokenAddress, timelockAddress);
		await governor.waitForDeployment();
		const governorAddress = await governor.getAddress();
		console.log("Governor deployed at:", governorAddress);

		await verifyOrLog({
			address: governorAddress,
			constructorArguments: [voteTokenAddress, timelockAddress],
			contract: "contracts/governor.sol:OpenvinoGovernor",
			shouldVerify,
		});

		// Optionally tune Governor settings post-deploy
		try {
			const currentVotingDelay = await governor.votingDelay();
			const currentVotingPeriod = await governor.votingPeriod();
			const currentProposalThreshold = await governor.proposalThreshold();

			const newVotingDelay = Number(
				await prompt.ask(
					`Voting delay (bloques) [actual ${currentVotingDelay}]`,
					process.env.GOV_VOTING_DELAY || currentVotingDelay.toString()
				)
			);
			const newVotingPeriod = Number(
				await prompt.ask(
					`Voting period (bloques) [actual ${currentVotingPeriod}]`,
					process.env.GOV_VOTING_PERIOD || currentVotingPeriod.toString()
				)
			);
			const newProposalThreshold = BigInt(
				await prompt.ask(
					`Proposal threshold (wei de votos) [actual ${currentProposalThreshold}]`,
					process.env.GOV_PROPOSAL_THRESHOLD || currentProposalThreshold.toString()
				)
			);

			if (BigInt(newVotingDelay) !== BigInt(currentVotingDelay)) {
				const tx = await governor["setVotingDelay(uint256)"](newVotingDelay);
				await tx.wait();
				console.log(`VotingDelay actualizado a ${newVotingDelay}`);
			}
			if (BigInt(newVotingPeriod) !== BigInt(currentVotingPeriod)) {
				const tx = await governor["setVotingPeriod(uint256)"](newVotingPeriod);
				await tx.wait();
				console.log(`VotingPeriod actualizado a ${newVotingPeriod}`);
			}
			if (newProposalThreshold !== BigInt(currentProposalThreshold)) {
				const tx = await governor["setProposalThreshold(uint256)"](newProposalThreshold);
				await tx.wait();
				console.log(`ProposalThreshold actualizado a ${newProposalThreshold}`);
			}
		} catch (readErr) {
			console.warn("No se pudieron leer/ajustar parámetros del Governor, se omite:", readErr);
		}

		// Setear oracle y asignar RESETTER_ROLE al DAO (obligatorio)
		const splitOracleAddress = await prompt.ask(
			"Oracle de split (requerido)",
			process.env.SPLIT_ORACLE_ADDRESS || ""
		);
		if (!splitOracleAddress) {
			throw new Error("Debes ingresar la dirección del SplitOracle");
		}
		try {
			await dao.setOracle(splitOracleAddress);
			console.log("Oracle seteado en DAO:", splitOracleAddress);
			const splitOracleArtifact = await artifacts.readArtifact("SplitOracle");
			const splitOracle = new ethers.Contract(
				splitOracleAddress,
				splitOracleArtifact.abi,
				signer
			);
			const resetterRole = await splitOracle.RESETTER_ROLE();
			const grantTx = await splitOracle.grantRole(resetterRole, daoAddress);
			await grantTx.wait();
			console.log("RESETTER_ROLE otorgado al DAO en el oracle");
		} catch (err) {
			console.warn("No se pudo setear el oracle / otorgar rol RESETTER:", err);
			throw err;
		}

		console.log("\nConfiguring Timelock roles...");
		const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
		const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
		let CANCELLER_ROLE;
		try {
			CANCELLER_ROLE = await timelock.CANCELLER_ROLE();
		} catch {
			CANCELLER_ROLE = null;
		}

		const hasGovProposer = await timelock.hasRole(PROPOSER_ROLE, governorAddress);
		if (!hasGovProposer) {
			const tx = await timelock.grantRole(PROPOSER_ROLE, governorAddress);
			await tx.wait();
			console.log("Granted PROPOSER_ROLE to Governor");
		} else {
			console.log("Governor already has PROPOSER_ROLE");
		}

		if (CANCELLER_ROLE) {
			const hasGovCanceller = await timelock.hasRole(CANCELLER_ROLE, governorAddress);
			if (!hasGovCanceller) {
				const tx = await timelock.grantRole(CANCELLER_ROLE, governorAddress);
				await tx.wait();
				console.log("Granted CANCELLER_ROLE to Governor");
			}
		}

		const anyoneIsExecutor = await timelock.hasRole(EXECUTOR_ROLE, ethers.ZeroAddress);
		console.log("Executor open to anyone:", anyoneIsExecutor);

		const deployedAddresses = {
			timelock: timelockAddress,
			dao: daoAddress,
			voteToken: voteTokenAddress,
			governor: governorAddress,
			tokenName,
			tokenSymbol,
			shareName,
			shareSymbol,
			minDelay,
			proposers,
			executors,
			admin,
		};

		const outputPath = path.join(__dirname, "../deployments/dao.json");
		fs.mkdirSync(path.dirname(outputPath), { recursive: true });
		fs.writeFileSync(outputPath, JSON.stringify(deployedAddresses, null, 2));
		console.log("\n📁 DAO contract addresses saved to:", outputPath);

		// Build-info + Standard JSON for manual verify (per contract)
		const saveArtifacts = (file, name, addr, label) => {
			const bi = findBuildInfo(file, name);
			if (bi?.data) {
				writeVerifyFiles({
					scriptLabel: "deploy_dao",
					label,
					address: addr,
					buildInfoData: bi.data,
				});
			}
		};
		saveArtifacts("contracts/timelock.sol", "OpenvinoTimelock", timelockAddress, "timelock");
		saveArtifacts("contracts/OpenvinoDao.sol", "OpenvinoDao", daoAddress, `dao_${tokenSymbol}`);
		saveArtifacts("contracts/vault/OpenVinoTokenVault.sol", "OpenVinoTokenVault", voteTokenAddress, "vault");
		saveArtifacts("contracts/governor/OpenvinoGovernor.sol", "OpenvinoGovernor", governorAddress, "governor");

		console.log("\n✅ Deploy complete.");
	} catch (err) {
		console.error("❌ Deployment error:", err);
		process.exitCode = 1;
	} finally {
		prompt.close();
	}
}

main()
	.catch((err) => {
		console.error("❌ Deployment error:", err);
		process.exitCode = 1;
	});
