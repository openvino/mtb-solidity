const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
	const [proposer] = await ethers.getSigners();
	const recipient = "0x228746DcDf0633299a630484BfE4ccB08711e0De";

	const deployments = JSON.parse(
		fs.readFileSync(path.join(__dirname, "../deployments/dao.json"))
	);

	const daoAddress = deployments.dao;
	const governorAddress = deployments.governor;
	const timelockAddress = deployments.timelock;

	const dao = await ethers.getContractAt("OpenvinoDao", daoAddress);
	const governor = await ethers.getContractAt("OpenvinoGovernor", governorAddress);

	const amount = ethers.parseEther("52");

	// Crear la propuesta: transferir tokens desde el timelock (treasury) a recipient
	console.log(
		`\nCreando propuesta para transferir ${ethers.formatEther(
			amount
		)} OVI desde el timelock (${timelockAddress}) a ${recipient}...`
	);

	const calldata = dao.interface.encodeFunctionData("transfer", [
		recipient,
		amount,
	]);
	const description = `Proposal #6: Transfer ${ethers.formatEther(
		amount
	)} OVI from Treasury to ${recipient}`;

	const tx = await governor.propose([daoAddress], [0], [calldata], description);
	const receipt = await tx.wait();
	const proposalId = receipt.logs[0].args.proposalId;

	console.log("Propuesta creada");
	console.log("Proposal ID:", proposalId.toString());
	console.log(
		`\nPara votar, ejecutá:\n  await governor.castVote(${proposalId}, 1) // 1 = For`
	);
}

main().catch((err) => {
	console.error("Error ejecutando el script:", err);
	process.exit(1);
});
