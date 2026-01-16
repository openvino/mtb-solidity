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

  const governor = await ethers.getContractAt("OpenvinoGovernor", governorAddress);

  const recipient = "0x87495d92Ad7655BF8bcC6447ea715498238517aF";
  const amountInEth = "0.0009";

  // Datos para la propuesta
  const targets = [recipient]; // el que recibe los fondos
  const values = [ethers.parseEther(amountInEth)];
  const calldatas = ["0x"]; // calldata vacía para enviar ETH
  const description = `Proposal #9: Send ${amountInEth} ETH from Timelock to ${recipient}`;

  console.log(`\n Creando propuesta para enviar ${amountInEth} ETH desde el Timelock a ${recipient}...`);

  const tx = await governor.propose(targets, values, calldatas, description);
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
