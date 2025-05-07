const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [proposer] = await ethers.getSigners();

  // Dirección del Safe (puede incluir prefijo de red):
  let safeAddr = "basesep:0x228746DcDf0633299a630484BfE4ccB08711e0De";
  // Si viene con prefijo (e.g. "basesep:"), lo eliminamos para usar solo la dirección cruda
  if (safeAddr.includes(':')) {
    safeAddr = safeAddr.split(':')[1];
  }

  // Destinatario y monto a transferir
  const recipient = "0x87495d92Ad7655BF8bcC6447ea715498238517aF";
  const amount = ethers.parseEther("100"); // 100 OVI

  // Cargamos las direcciones desplegadas
  const deployments = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../deployments/dao.json"))
  );
  const dao = await ethers.getContractAt("OpenvinoDao", deployments.dao);
  const governor = await ethers.getContractAt("MyGovernor", deployments.governor);

  // Log inicial
  console.log(`\n🗳️ Creando propuesta para que el SAFE (${safeAddr}) transfiera ${ethers.formatEther(amount)} OVI a ${recipient}...`);

  // Codificar la llamada transfer en el DAO
  const calldata = dao.interface.encodeFunctionData("transfer", [recipient, amount]);
  const description = `Proposal: Safe transfer ${ethers.formatEther(amount)} OVI to ${recipient}`;

  // Enviamos la propuesta al Governor
  const tx = await governor.propose(
    [deployments.dao],
    [0],
    [calldata],
    description
  );
  const receipt = await tx.wait();

  const proposalId = receipt.logs[0].args.proposalId;
  console.log("✅ Propuesta creada con ID:", proposalId.toString());
  console.log(`\nPara votar: await governor.castVote(${proposalId}, 1) // 1 = For`);
}

main().catch((err) => {
  console.error("❌ Error ejecutando el script:", err);
  process.exit(1);
});
