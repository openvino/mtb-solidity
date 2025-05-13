const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [proposer] = await ethers.getSigners();
  const deployments = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../deployments/dao.json"))
  );

  const daoAddress = deployments.dao;
  const governorAddress = deployments.governor;

  const dao = await ethers.getContractAt("OpenvinoDao", daoAddress);
  const governor = await ethers.getContractAt("MyGovernor", governorAddress);

  const recipient = "0x350B8c6F66fbC146E00B0356A1d8879a708B3445";
  const amount = ethers.parseEther("100"); // 100 OVI

  const calldata = dao.interface.encodeFunctionData("mint", [recipient, amount]);
  const description = "Proposal #4: Mint 100 OVI to proposer";

  console.log("Proposing mint...");

  const tx = await governor.propose(
    [daoAddress],
    [0],
    [calldata],
    description
  );

  const receipt = await tx.wait();
  const proposalId = receipt.logs[0].args.proposalId;

  console.log("Proposal submitted!");
  console.log("Proposal ID:", proposalId.toString());
  console.log(`
To vote, run:
  await governor.castVote(${proposalId}, 1) // 1 = For
  `);
}

main().catch((err) => {
  console.error("Proposal error:", err);
  process.exit(1);
});