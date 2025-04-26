const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Usando cuenta:", deployer.address);

  // 🪙 Parámetros del token
  const name = "TEST TOKEN";
  const symbol = "MTB";
  const cap = ethers.parseEther("1024"); // Cap total: 300 tokens

  // 🔨 Desplegar el token SIN mintear
  const MTB = await ethers.getContractFactory("MTB");
  const mtb = await MTB.deploy(name, symbol, cap);
  await mtb.waitForDeployment();
  const tokenAddress = await mtb.getAddress();

  console.log(`Token ${symbol} desplegado en:`, tokenAddress);

  // ⚙️ Parámetros del crowdsale
  const wallet = deployer.address; // Wallet que recibe el ETH
  const openingTime = Math.floor(Date.now() / 1000) + 60; // arranca en 1 minuto
  const closingTime = openingTime + 7 * 24 * 60 * 60; // termina en 1 semana
  const rate = 1700; // tokens por 1 ETH
  const capEth = ethers.parseEther("100"); // Límite de ETH a recaudar

  // 🏛️ Desplegar el contrato de crowdsale
  const Crowdsale = await ethers.getContractFactory("Crowdsale");
  const crowdsale = await Crowdsale.deploy(
    wallet,
    tokenAddress,
    capEth,
    openingTime,
    closingTime,
    rate
  );
  await crowdsale.waitForDeployment();
  const crowdsaleAddress = await crowdsale.getAddress();

  console.log("Crowdsale desplegado en:", crowdsaleAddress);

  // 🪙 Mint de tokens
  const tokensForDeployer = ethers.parseEther("100");
  const tokensForCrowdsale = ethers.parseEther("200");

  const mintDeployerTx = await mtb.mint(deployer.address, tokensForDeployer);
  await mintDeployerTx.wait();
  console.log(
    `Minted ${ethers.formatEther(tokensForDeployer)} tokens al deployer`
  );

  const mintCrowdsaleTx = await mtb.mint(crowdsaleAddress, tokensForCrowdsale);
  await mintCrowdsaleTx.wait();
  console.log(
    `Minted ${ethers.formatEther(tokensForCrowdsale)} tokens al crowdsale`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
