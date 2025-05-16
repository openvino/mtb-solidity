const { ethers, run } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀 Deploying with account:", deployer.address);

  // Dirección de tu token ya desplegado
  const tokenAddress = "0x9B103472aE9e654d836Fe699a65C27D01BD40213";

  // Parámetros de Crowdsale
  const Crowdsale = await ethers.getContractFactory("CrowdsaleOVI");
  const wallet = deployer.address;

  // 1) Cap total en ETH (en wei)
  const ethCap = ethers.parseEther("500");  // 500 ETH límite total

  // 2) Tiempos
  const openingTime = Math.floor(Date.now() / 1000);
  const closingTime = openingTime + 7 * 24 * 60 * 60; // +7 días

  // 3) Límite de tokens para fase 1
  // Queremos 500.000 USD en fase1 a 1.25 USD/token → 400.000 tokens
  const phaseOneTokenCap = ethers.parseUnits("10", 18);

  // 4) Precios por token (en USD con 18 decimales)
  const ratePhaseOne = ethers.parseUnits("1.25", 18); // 1.25 USD/token
  const ratePhaseTwo = ethers.parseUnits("2.5", 18);   // 2.50 USD/token

  // 5) Oráculo Chainlink ETH/USD (Sepolia Base)
  const priceFeed = "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1";

  // Desplegar Crowdsale
  const crowdsale = await Crowdsale.deploy(
    wallet,
    tokenAddress,
    ethCap,
    openingTime,
    closingTime,
    phaseOneTokenCap,
    ratePhaseOne,
    ratePhaseTwo,
    priceFeed
  );
  const crowdsaleAddress = await crowdsale.getAddress();
  console.log("✅ CrowdsaleOVI deployed at:", crowdsaleAddress);

  // Verificar en Etherscan
  try {
    await run("verify:verify", {
      address: crowdsaleAddress,
      constructorArguments: [
        wallet,
        tokenAddress,
        ethCap,
        openingTime,
        closingTime,
        phaseOneTokenCap,
        ratePhaseOne,
        ratePhaseTwo,
        priceFeed,
      ],
    });
    console.log("🔍 Crowdsale verified on Etherscan");
  } catch (err) {
    console.warn("⚠️ Verification failed:", err.message);
  }


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
