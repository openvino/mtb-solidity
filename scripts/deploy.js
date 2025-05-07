const { ethers, run } = require("hardhat");
const { tokens } = require("../utils/tokens");
const fs = require("fs");
const path = require("path");

const { parseEther } = ethers;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const MTB = await ethers.getContractFactory("MTB");
  const deployedAddresses = {};

  for (const token of tokens) {
    const capInWei = parseEther(token.cap.toString());
    const mintBase = token.initialMint ?? token.cap;
    const mintInWei = parseEther(mintBase.toString());

    console.log(`   Deploying ${token.name} (${token.symbol})`);
    console.log(`   Cap: ${token.cap} tokens`);
    console.log(`   Initial mint: ${mintBase} tokens`);

    const mtb = await MTB.deploy(token.name, token.symbol, capInWei, mintInWei);
    await mtb.waitForDeployment();

    const address = await mtb.getAddress();
    deployedAddresses[token.symbol] = address;

    console.log(`${token.symbol} deployed at: ${address}`);

    // Verificación en Etherscan
    console.log(`Verifying ${token.symbol}...`);
    try {
      await run("verify:verify", {
        address,
        constructorArguments: [
          token.name,
          token.symbol,
          capInWei,
          mintInWei,
        ],
      });
      console.log(`Verified ${token.symbol} on Etherscan`);
    } catch (err) {
      console.warn(`Verification failed for ${token.symbol}: ${err.message}`);
    }
  }

  // Guardar JSON con direcciones
  const outputPath = path.join(__dirname, "../deployments/mtb-tokens.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(deployedAddresses, null, 2));

  console.log("\n📁 Token addresses saved to:", outputPath);
  console.log("All tokens deployed and attempted to verify!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment error:", error);
    process.exit(1);
  });