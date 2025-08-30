/* scripts/deploy-entitlement-did.js */
const { ethers, run } = require("hardhat");
const fs = require("fs");
const path = require("path");

function getCliArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return null;
}

async function verifyOrLog({ address, constructorArguments = [], contract }) {
  try {
    await run("verify:verify", { address, constructorArguments, contract });
    console.log(`Verified: ${address}`);
  } catch (err) {
    const msg = err?.message || String(err);
    if (msg.includes("Already Verified")) {
      console.log(`Already verified: ${address}`);
    } else {
      console.warn(`Verification failed (${address}):`, msg);
    }
  }
}

async function main() {
  const timelockFromEnv = "0xc779751feA3A97eEDC1688270a03b5BAa9f881F6";
  const timelockFromCli = getCliArg("timelock");
  const timelock = timelockFromCli || timelockFromEnv;

  if (!timelock) {
    console.error("❌ Falta la dirección del Timelock.");
    console.error("   Pasala por env TIMELOCK_ADDRESS o por CLI --timelock 0x... ");
    process.exit(1);
  }

  if (!ethers.isAddress(timelock)) {
    console.error("❌ TIMELOCK_ADDRESS inválido:", timelock);
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Timelock:", timelock);

  console.log("\nDeploying EntitlementRegistryDID...");
  const Factory = await ethers.getContractFactory("EntitlementRegistryDID");
  const contract = await Factory.deploy(timelock);
  await contract.waitForDeployment();
  const registryAddress = await contract.getAddress();
  console.log("EntitlementRegistryDID deployed at:", registryAddress);

  // Verificación (ajustá 'contract' si tu ruta/nombre difiere)
  await verifyOrLog({
    address: registryAddress,
    constructorArguments: [timelock],
    contract: "contracts/Entitlement.sol:EntitlementRegistryDID",
  });

  // Persistir
  const out = {
    entitlementRegistryDID: registryAddress,
    timelock,
    network: (await deployer.provider.getNetwork()).name,
    chainId: (await deployer.provider.getNetwork()).chainId?.toString(),
  };

  const outputPath = path.join(__dirname, "../deployments/entitlement.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2));
  console.log("\n📁 Saved to:", outputPath);

  console.log("\n✅ Done.");
}

main().catch((err) => {
  console.error("❌ Deployment error:", err);
  process.exit(1);
});