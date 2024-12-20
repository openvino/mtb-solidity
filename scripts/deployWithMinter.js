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

	const tokenMinterAbi = [
		{
			inputs: [
				{
					internalType: "address",
					name: "tokenAddress",
					type: "address",
				},
			],
			name: "addToken",
			outputs: [],
			stateMutability: "nonpayable",
			type: "function",
		},
	];

	const tokenMinter = new ethers.Contract(
		tokenMinterAddress,
		tokenMinterAbi,
		deployer
	);

	for (const token of tokens) {
		const capInEther = parseEther(token.cap.toString());

		console.log(
			`Deploying ${token.name} (${token.symbol}) with cap: ${token.cap}`
		);

		const mtb = await MTB.deploy(token.name, token.symbol, capInEther);

		console.log(`${token.name} (${token.symbol}) deployed to:`, mtb.target);

		console.log(
			`Granting minter role to TokenMinter for ${token.name} (${token.symbol})...`
		);

		const grantTx = await mtb.addMinter(tokenMinterAddress);
		await grantTx.wait();

		console.log(
			`Minter role granted to TokenMinter for ${token.name} (${token.symbol})`
		);

		console.log(
			`Adding ${token.name} (${token.symbol}) to allowed tokens in TokenMinter...`
		);

		const addTokenTx = await tokenMinter.addToken(mtb.target);
		await addTokenTx.wait();

		console.log(
			`${token.name} (${token.symbol}) added to allowed tokens in TokenMinter.`
		);
	}

	console.log(
		"All tokens deployed, minter role granted, and tokens added to TokenMinter!"
	);
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
