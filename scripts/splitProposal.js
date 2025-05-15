const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
	const [proposer] = await ethers.getSigners();

	const deployments = JSON.parse(
		fs.readFileSync(path.join(__dirname, "../deployments/dao.json"))
	);

	const governorAddress = deployments.governor;
	const timelockAddress = deployments.timelock;
	const oviAddress = deployments.dao; // OVI es el DAO token

	const governor = await ethers.getContractAt("MyGovernor", governorAddress);
	const ovi = await ethers.getContractAt("OpenvinoDao", oviAddress);

	// Encodear la llamada a split()
	const calldata = ovi.interface.encodeFunctionData("split", []);

	// Datos para la propuesta
	const targets = [oviAddress];
	const values = [0]; // no se transfiere ETH
	const calldatas = [calldata];
	const description = `Proposal #X: Call split() on OVI contract via Timelock`;

	console.log(
		`\nCreando propuesta para ejecutar split() en OVI desde el Timelock...`
	);

	const tx = await governor.propose(targets, values, calldatas, description);
	const receipt = await tx.wait();
	const proposalId = receipt.logs[0].args.proposalId;

	console.log("✅ Propuesta creada");
	console.log("🆔 Proposal ID:", proposalId.toString());
	console.log(
		`\n📣 Para votar:\n  await governor.castVote(${proposalId}, 1) // 1 = For`
	);
}

main().catch((err) => {
	console.error("❌ Error ejecutando el script:", err);
	process.exit(1);
});
