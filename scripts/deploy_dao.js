const { ethers, run } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1. Deploy Timelock
  const minDelay = 60; // 1 minuto
  const proposers = [deployer.address];
  const executors = [ethers.ZeroAddress];
  const admin = deployer.address;

  console.log("\nDeploying Timelock...");
  const Timelock = await ethers.getContractFactory("MyTimelock");
  const timelock = await Timelock.deploy(minDelay, proposers, executors, admin);
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log("Timelock deployed at:", timelockAddress);

  try {
    await run("verify:verify", {
      address: timelockAddress,
      constructorArguments: [minDelay, proposers, executors, admin],
      contract: "contracts/timelock.sol:MyTimelock",
    });
    console.log("Timelock verified");
  } catch (err) {
    console.warn("Timelock verification failed:", err.message);
  }


  console.log("\nDeploying DAO Token (OVI)...");

  const DAO = await ethers.getContractFactory("OpenvinoDao");
  const dao = await DAO.deploy(
    deployer.address, // recipient
    deployer.address, // defaultAdmin
    deployer.address, // pauser
    deployer.address  // minter
  );
  await dao.waitForDeployment();
  const daoAddress = await dao.getAddress();
  console.log("DAO Token deployed at:", daoAddress);

  try {
    await run("verify:verify", {
      address: daoAddress,
      constructorArguments: [
        deployer.address,
        deployer.address,
        deployer.address,
        deployer.address
      ],
    });
    console.log("DAO Token verified");
  } catch (err) {
    console.warn("DAO Token verification failed:", err.message);
  }

  
  console.log("\nDelegating voting power to deployer...");
  const delegateTx = await dao.delegate(deployer.address);
  await delegateTx.wait();
  console.log("Delegated voting power to deployer:", deployer.address);

  console.log("\nDeploying Governor...");
  const Governor = await ethers.getContractFactory("MyGovernor");
  const governor = await Governor.deploy(daoAddress, timelockAddress);
  await governor.waitForDeployment();
  const governorAddress = await governor.getAddress();
  console.log("Governor deployed at:", governorAddress);

  try {
    await run("verify:verify", {
      address: governorAddress,
      constructorArguments: [daoAddress, timelockAddress],
      contract: "contracts/governor.sol:MyGovernor",
    });
    console.log("Governor verified");
  } catch (err) {
    console.warn("Governor verification failed:", err.message);
  }

  
  const deployedAddresses = {
    timelock: timelockAddress,
    dao: daoAddress,
    governor: governorAddress,
  };

  const outputPath = path.join(__dirname, "../deployments/dao.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(deployedAddresses, null, 2));

  console.log("\n\ud83d\udcc1 DAO contract addresses saved to:", outputPath);
}

main().catch((err) => {
  console.error("\u274c Deployment error:", err);
  process.exit(1);
});
