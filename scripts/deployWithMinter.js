require("dotenv").config();
const { ethers } = require("hardhat");
const { tokens } = require("../utils/tokens");

const { parseEther } = ethers;

async function main() {
	const [deployer] = await ethers.getSigners();
	console.log("Deploying contracts with the account:", deployer.address);

	const MTB = await ethers.getContractFactory("MTB");
	const tokenMinterAddress = process.env.TOKEN_MINTER;

	if (!tokenMinterAddress) {
		console.error("TOKEN_MINTER address not set in environment variables.");
		process.exit(1);
	}

	for (const token of tokens) {
		const capInEther = parseEther(token.cap.toString());

		console.log(
			`Deploying ${token.name} (${token.symbol}) with cap: ${token.cap}`
		);

		// Desplegar el contrato MTB
		const mtb = await MTB.deploy(token.name, token.symbol, capInEther);

		console.log(`${token.name} (${token.symbol}) deployed to:`, mtb.target);

		// Otorgar al TokenMinter el permiso de mintear
		console.log(
			`Granting minter role to TokenMinter for ${token.name} (${token.symbol})...`
		);

		// Usar la función addMinter si está disponible en el contrato
		const tx = await mtb.addMinter(tokenMinterAddress);
		await tx.wait();

		console.log(
			`Minter role for ${process.env.TOKEN_MINTER} granted to TokenMinter for ${token.name} (${token.symbol})`
		);
	}

	console.log("All tokens deployed and minter role granted!");
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
