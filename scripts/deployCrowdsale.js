const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Usando cuenta:", deployer.address);

  const tokenAddress = "0xF0E02Aee8B0CEcf5b4594957Db548a7C05de8282"; // Asegurate que esté bien

  if (!ethers.isAddress(tokenAddress)) {
    throw new Error("Dirección del token inválida");
  }

  const wallet = deployer.address;
  const cap = ethers.parseEther("100"); // 100 ETH de tope
  const openingTime = Math.floor(Date.now() / 1000) + 60; // arranca en 1 minuto
  const closingTime = openingTime + 7 * 24 * 60 * 60; // 1 semana

  // Aquí calculamos el rate, que es 1700 tokens por 1 ETH
  const rate = 1700; // Tokens por 1 ETH

  const Crowdsale = await ethers.getContractFactory("Crowdsale");
  const crowdsale = await Crowdsale.deploy(
    wallet,
    tokenAddress,
    cap,
    openingTime,
    closingTime,
    rate // Ahora pasamos el rate calculado
  );

  await crowdsale.waitForDeployment();

  console.log("Crowdsale desplegado en:", await crowdsale.getAddress());

  // Transferencia de tokens al contrato
  const mtb = await ethers.getContractAt("MTB", tokenAddress);
  const amountToTransfer = ethers.parseEther("200"); // Tokens que quieras poner en venta

  const tx = await mtb.transfer(await crowdsale.getAddress(), amountToTransfer);
  await tx.wait();

  console.log(
    `Transferidos ${ethers.formatEther(amountToTransfer)} tokens al crowdsale`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
