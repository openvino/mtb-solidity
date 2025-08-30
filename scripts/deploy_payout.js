// scripts/deploy_payout.js
// Hardhat + ethers v6

require("dotenv").config();
const hre = require("hardhat");

async function main() {
	const timelock = "0xc779751feA3A97eEDC1688270a03b5BAa9f881F6";
	const Payout = await hre.ethers.getContractFactory("Payout");
	const payout = await Payout.deploy(timelock); // v6 deploy
	await payout.waitForDeployment(); // ✅ v6: waitForDeployment()
	const addr = await payout.getAddress(); // ✅ v6: getAddress()

	console.log("Payout deployed at:", addr);

	// (opcional) verificación
	try {
		await hre.run("verify:verify", {
			address: addr,
			constructorArguments: [timelock],
			// contract: 'contracts/Payout.sol:Payout', // descomentar si tu ruta/nombre lo requiere
		});
		console.log("Verified OK");
	} catch (e) {
		console.log("Verify skipped/failed:", e.message ?? e);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
