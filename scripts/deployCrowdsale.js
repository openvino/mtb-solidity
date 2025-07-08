const { ethers } = require("hardhat");

async function main() {
	const [deployer] = await ethers.getSigners();
	console.log("Usando cuenta:", deployer.address);

	const tokenAddress = "0xA803B26BB963d9A90e7A5267BD1F5A4a9F034B37"; // Asegurate que esté bien

	if (!ethers.isAddress(tokenAddress)) {
		throw new Error("Dirección del token inválida");
	}

	const wallet = "0x87495d92Ad7655BF8bcC6447ea715498238517aF"; //WALLET QUE RECIBIRÁ EL ETH
	const cap = ethers.parseEther("100");
	const ONE_DAY = 24 * 60 * 60;
	const openingTime = Math.floor(Date.now() / 1000) + 60; // arranca en 1 minuto
	// const closingTime = openingTime + (80 * ONE_DAY); // termina en 80 días
	const closingTime = openingTime + 1;

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
	const mtb = await ethers.getContractAt("OpenVinoToken", tokenAddress);
	const amountToTransfer = ethers.parseEther("1024"); // Tokens que quieras poner en venta

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
				rate,
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
