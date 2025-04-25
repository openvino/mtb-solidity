const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [proposer] = await ethers.getSigners();
  const recipient = "0x87495d92Ad7655BF8bcC6447ea715498238517aF"; // dirección destinataria

  const deployments = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../deployments/dao.json"))
  );

  const daoAddress = deployments.dao;
  const governorAddress = deployments.governor;
  const timelockAddress = deployments.timelock;

  const dao = await ethers.getContractAt("OpenvinoDao", daoAddress);
  const governor = await ethers.getContractAt("MyGovernor", governorAddress);

  const amount = ethers.parseEther("1000"); // 100 OVI

  // Crear la propuesta: transferir tokens desde el timelock (treasury) a recipient
  console.log(`\nCreando propuesta para transferir ${ethers.formatEther(amount)} OVI desde el timelock (${timelockAddress}) a ${recipient}...`);

  const calldata = dao.interface.encodeFunctionData("transfer", [recipient, amount]);
  const description = `Proposal #11: Transfer ${ethers.formatEther(amount)} OVI from Treasury to ${recipient}`;

  const tx = await governor.propose([daoAddress], [0], [calldata], description);
  const receipt = await tx.wait();
  const proposalId = receipt.logs[0].args.proposalId;

  console.log("Propuesta creada");
  console.log("Proposal ID:", proposalId.toString());
  console.log(`\nPara votar, ejecutá:\n  await governor.castVote(${proposalId}, 1) // 1 = For`);
}

main().catch((err) => {
  console.error("Error ejecutando el script:", err);
  process.exit(1);
});
