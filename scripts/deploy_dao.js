/* scripts/deploy-dao.js */
const { ethers, run } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function verifyOrLog({ address, constructorArguments = [], contract }) {
	try {
		await run("verify:verify", { address, constructorArguments, contract });
		console.log(`Verified: ${address}`);
	} catch (err) {
		console.warn(`Verification failed (${address}):`, err?.message || err);
	}
}

async function main() {
	const [deployer] = await ethers.getSigners();
	console.log("Deployer:", deployer.address);

	// ---------- 1) Timelock ----------
	const minDelay = 60; // 1 minuto
	const proposers = [deployer.address]; // quien puede queuear inicialmente
	const executors = [ethers.ZeroAddress]; // 0x0 => cualquiera puede ejecutar
	const admin = deployer.address; // admin inicial de roles

	console.log("\nDeploying Timelock...");
	const Timelock = await ethers.getContractFactory("MyTimelock");
	const timelock = await Timelock.deploy(minDelay, proposers, executors, admin);
	await timelock.waitForDeployment();
	const timelockAddress = await timelock.getAddress();
	console.log("Timelock deployed at:", timelockAddress);

	await verifyOrLog({
		address: timelockAddress,
		constructorArguments: [minDelay, proposers, executors, admin],
		contract: "contracts/timelock.sol:MyTimelock",
	});

	// ---------- 2) Token (OpenvinoDao) ----------
	console.log("\nDeploying DAO Token (OVI)...");
	const DAO = await ethers.getContractFactory("OpenvinoDao");
	const dao = await DAO.deploy(
		deployer.address, // recipient / initial holder (si aplica)
		deployer.address, // defaultAdmin
		deployer.address // pauser
	);
	await dao.waitForDeployment();
	const daoAddress = await dao.getAddress();
	console.log("DAO Token deployed at:", daoAddress);

	await verifyOrLog({
		address: daoAddress,
		constructorArguments: [
			deployer.address,
			deployer.address,
			deployer.address,
		],
		// si necesitás ruta específica: contract: "contracts/OpenvinoDao.sol:OpenvinoDao",
	});

	console.log("\nDelegating voting power to deployer...");
	const delegateTx = await dao.delegate(deployer.address);
	await delegateTx.wait();
	console.log("Delegated voting power to:", deployer.address);

	// ---------- 3) Governor ----------
	console.log("\nDeploying Governor...");
	const Governor = await ethers.getContractFactory("MyGovernor");
	const governor = await Governor.deploy(daoAddress, timelockAddress);
	await governor.waitForDeployment();
	const governorAddress = await governor.getAddress();
	console.log("Governor deployed at:", governorAddress);

	await verifyOrLog({
		address: governorAddress,
		constructorArguments: [daoAddress, timelockAddress],
		contract: "contracts/governor.sol:MyGovernor",
	});

	// ---------- 4) Roles en Timelock ----------
	// Darle al Governor permisos para queuear/cancelar en el Timelock.
	// (ejecutar: cualquiera, ya que EXECUTOR_ROLE = 0x0)
	console.log("\nConfiguring Timelock roles...");

	const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
	const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
	let CANCELLER_ROLE;
	try {
		CANCELLER_ROLE = await timelock.CANCELLER_ROLE();
	} catch {
		// Si tu Timelock no define CANCELLER_ROLE, lo omitimos
	}

	// Grant PROPOSER to Governor (necesario para queue)
	const hasGovProposer = await timelock.hasRole(PROPOSER_ROLE, governorAddress);
	if (!hasGovProposer) {
		const tx = await timelock.grantRole(PROPOSER_ROLE, governorAddress);
		await tx.wait();
		console.log("Granted PROPOSER_ROLE to Governor");
	} else {
		console.log("Governor already has PROPOSER_ROLE");
	}

	// (Opcional) Grant CANCELLER to Governor si tu flujo lo usa
	if (CANCELLER_ROLE) {
		const hasGovCanceller = await timelock.hasRole(
			CANCELLER_ROLE,
			governorAddress
		);
		if (!hasGovCanceller) {
			const tx = await timelock.grantRole(CANCELLER_ROLE, governorAddress);
			await tx.wait();
			console.log("Granted CANCELLER_ROLE to Governor");
		} else {
			console.log("Governor already has CANCELLER_ROLE");
		}
	}

	// Executor abierto ya quedó configurado por constructor; validamos:
	const anyoneIsExecutor = await timelock.hasRole(
		EXECUTOR_ROLE,
		ethers.ZeroAddress
	);
	console.log("Executor open to anyone:", anyoneIsExecutor);

	// (Opcional) Si querés que el deployer ya no pueda proponer:
	// const hasDeployerProposer = await timelock.hasRole(PROPOSER_ROLE, deployer.address);
	// if (hasDeployerProposer) {
	//   const tx = await timelock.revokeRole(PROPOSER_ROLE, deployer.address);
	//   await tx.wait();
	//   console.log("Revoked PROPOSER_ROLE from deployer");
	// }

	// (Opcional, avanzado) transferir/renunciar admin para descentralizar:
	// const DEFAULT_ADMIN_ROLE = await timelock.DEFAULT_ADMIN_ROLE();
	// await timelock.grantRole(DEFAULT_ADMIN_ROLE, governorAddress); // o multi-sig
	// await timelock.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);

	// ---------- 5) Persistir direcciones ----------
	const deployedAddresses = {
		timelock: timelockAddress,
		dao: daoAddress,
		governor: governorAddress,
	};

	const outputPath = path.join(__dirname, "../deployments/dao.json");
	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	fs.writeFileSync(outputPath, JSON.stringify(deployedAddresses, null, 2));
	console.log("\n📁 DAO contract addresses saved to:", outputPath);

	console.log("\n✅ Deploy + roles configurados. Listo.");
}

main().catch((err) => {
	console.error("❌ Deployment error:", err);
	process.exit(1);
});

// const { ethers, run } = require("hardhat");
// const fs = require("fs");
// const path = require("path");

// async function main() {
//   const [deployer] = await ethers.getSigners();
//   console.log("Deployer:", deployer.address);

//   // 1. Deploy Timelock
//   const minDelay = 60; // 1 minuto
//   const proposers = [deployer.address];
//   const executors = [ethers.ZeroAddress];
//   const admin = deployer.address;

//   console.log("\nDeploying Timelock...");
//   const Timelock = await ethers.getContractFactory("MyTimelock");
//   const timelock = await Timelock.deploy(minDelay, proposers, executors, admin);
//   await timelock.waitForDeployment();
//   const timelockAddress = await timelock.getAddress();
//   console.log("Timelock deployed at:", timelockAddress);

//   try {
//     await run("verify:verify", {
//       address: timelockAddress,
//       constructorArguments: [minDelay, proposers, executors, admin],
//       contract: "contracts/timelock.sol:MyTimelock",
//     });
//     console.log("Timelock verified");
//   } catch (err) {
//     console.warn("Timelock verification failed:", err.message);
//   }

//   console.log("\nDeploying DAO Token (OVI)...");

//   const DAO = await ethers.getContractFactory("OpenvinoDao");
//   const dao = await DAO.deploy(
//     deployer.address, // recipient
//     deployer.address, // defaultAdmin
//     deployer.address, // pauser

//   );
//   await dao.waitForDeployment();
//   const daoAddress = await dao.getAddress();
//   console.log("DAO Token deployed at:", daoAddress);

//   try {
//     await run("verify:verify", {
//       address: daoAddress,
//       constructorArguments: [
//         deployer.address,
//         deployer.address,
//         deployer.address
//       ],
//     });
//     console.log("DAO Token verified");
//   } catch (err) {
//     console.warn("DAO Token verification failed:", err.message);
//   }

//   console.log("\nDelegating voting power to deployer...");
//   const delegateTx = await dao.delegate(deployer.address);
//   await delegateTx.wait();
//   console.log("Delegated voting power to deployer:", deployer.address);

//   console.log("\nDeploying Governor...");
//   const Governor = await ethers.getContractFactory("MyGovernor");
//   const governor = await Governor.deploy(daoAddress, timelockAddress);
//   await governor.waitForDeployment();
//   const governorAddress = await governor.getAddress();
//   console.log("Governor deployed at:", governorAddress);

//   try {
//     await run("verify:verify", {
//       address: governorAddress,
//       constructorArguments: [daoAddress, timelockAddress],
//       contract: "contracts/governor.sol:MyGovernor",
//     });
//     console.log("Governor verified");
//   } catch (err) {
//     console.warn("Governor verification failed:", err.message);
//   }

//   const deployedAddresses = {
//     timelock: timelockAddress,
//     dao: daoAddress,
//     governor: governorAddress,
//   };

//   const outputPath = path.join(__dirname, "../deployments/dao.json");
//   fs.mkdirSync(path.dirname(outputPath), { recursive: true });
//   fs.writeFileSync(outputPath, JSON.stringify(deployedAddresses, null, 2));

//   console.log("\n\ud83d\udcc1 DAO contract addresses saved to:", outputPath);
// }

// main().catch((err) => {
//   console.error("\u274c Deployment error:", err);
//   process.exit(1);
// });
