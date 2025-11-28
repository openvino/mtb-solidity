const { ethers } = require("hardhat");

const GOVERNOR_ADDRESS = "0xE294CaE464BDa83b1bB239fb2dadb3e7F13b15F7"; // ← dirección del contrato Governor
const PROPOSAL_ID = "59046663460639403413891038593448032216048046307578025235994735158363045253691"; // ← ID de la propuesta (puede ser hash o BigNumber)

async function main() {
  const [voter] = await ethers.getSigners();
  console.log("🗳️ Voter address:", voter.address);

  const governor = await ethers.getContractAt("OpenvinoGovernor", GOVERNOR_ADDRESS);

  const state = await governor.state(PROPOSAL_ID);
  console.log("Estado actual de la propuesta:", state);

  if (state.toString() !== "1") {
    console.warn("La propuesta no está activa. No se puede votar.");
    return;
  }

  // Voto: 0 = Against, 1 = For, 2 = Abstain
  const voteType = 1;
  console.log(`🗳️ Votando '${voteType === 1 ? "For" : voteType === 0 ? "Against" : "Abstain"}' la propuesta ${PROPOSAL_ID}...`);

//   try {
//     const voteTx = await governor.castVote(PROPOSAL_ID, voteType);
//     await voteTx.wait();
//     console.log("Voto enviado con éxito:", voteTx.hash);
//   } catch (err) {
//     console.error("Vote error:", err);
//   }
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
