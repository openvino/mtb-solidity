const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [proposer] = await ethers.getSigners();
  const recipient = "0x350B8c6F66fbC146E00B0356A1d8879a708B3445"; 

  const deployments = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../deployments/dao.json"))
  );

  const daoAddress = deployments.dao;
  const voteTokenAddress = deployments.voteToken;
  const governorAddress = deployments.governor;
  const timelockAddress = deployments.timelock;

  const dao = await ethers.getContractAt("OpenvinoDao", daoAddress);
  const voteToken = await ethers.getContractAt("GovernanceOpenvinoDAO", voteTokenAddress);
  const governor = await ethers.getContractAt("OpenvinoGovernor", governorAddress);

  const amount = ethers.parseEther("1000"); // 1000 OVI

  
  console.log(`\n Dando allowance de ${ethers.formatEther(amount)} OVI a TimelockController (${timelockAddress})...`);
  const approveTx = await dao.approve(timelockAddress, amount);
  await approveTx.wait();
  console.log("Allowance otorgado");

  
  const currentVotes = await voteToken.getVotes(proposer.address);
  if (currentVotes === 0n) {
    console.log(`\nDelegando votos de wOVI a ${proposer.address}...`);
    const delegateTx = await voteToken.delegate(proposer.address);
    await delegateTx.wait();
    console.log("Delegación realizada");
  } else {
    console.log(" Votos ya delegados, omitiendo delegación");
  }

  
  console.log(`\n Creando propuesta para transferir ${ethers.formatEther(amount)} OVI a ${recipient} usando transferFrom...`);
  const calldata = dao.interface.encodeFunctionData("transferFrom", [proposer.address, recipient, amount]);
  const description = `Proposal: Transfer ${ethers.formatEther(amount)} OVI from proposer to ${recipient}`;

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
