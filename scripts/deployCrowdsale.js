const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Usando cuenta:", deployer.address);

  const tokenAddress = ""; // Asegurate que esté bien

  if (!ethers.isAddress(tokenAddress)) {
    throw new Error("Dirección del token inválida");
  }

  const wallet = "";
  const cap = ethers.parseEther("100"); // 100 ETH de tope
  const ONE_DAY = 24 * 60 * 60;
  const openingTime = Math.floor(Date.now() / 1000) + 60; // arranca en 1 minuto
  const closingTime = openingTime + (60 * ONE_DAY); // termina en 60 días
  

  // Aquí calculamos el rate, que es 1700 tokens por 1 ETH
  const rate = 53; // Tokens por 1 ETH

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
  const amountToTransfer = ethers.parseEther("600"); // Tokens que quieras poner en venta

  const tx = await mtb.transfer(await crowdsale.getAddress(), amountToTransfer);
  await tx.wait();


  const address = await crowdsale.getAddress();
  try {
        await run("verify:verify", {
          address,
          constructorArguments: [
           wallet,
            tokenAddress,
            cap,
            openingTime,
            closingTime,
            rate
          ],
        });
    
      } catch (err) {
        console.warn(err);
      }

  console.log(
    `Transferidos ${ethers.formatEther(amountToTransfer)} tokens al crowdsale`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
