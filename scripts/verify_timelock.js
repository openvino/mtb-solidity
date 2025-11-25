import "dotenv/config";
import hre from "hardhat";

// Run with:
// npx hardhat run scripts/verify_timelock.js --network baseSepolia

async function main() {
  const address = process.env.TIMELock_ADDRESS || process.env.TIMLOCK_ADDRESS || process.env.TIMELOCK_ADDRESS;
  if (!address) {
    throw new Error("Define TIMELOCK_ADDRESS (o TIMLOCK_ADDRESS) en .env");
  }

  const minDelay = Number(process.env.TIMELOCK_MIN_DELAY || "60");
  const proposers = (process.env.TIMELOCK_PROPOSERS || "").split(",").map((a) => a.trim()).filter(Boolean);
  const executors = (process.env.TIMELOCK_EXECUTORS || "").split(",").map((a) => a.trim()).filter(Boolean);
  const admin = process.env.TIMELOCK_ADMIN;
  if (!admin) {
    throw new Error("Define TIMELOCK_ADMIN en .env");
  }

  const constructorArguments = [minDelay, proposers, executors, admin];

  await hre.run("verify:verify", {
    address,
    constructorArguments,
    contract: "contracts/timelock.sol:MyTimelock",
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
