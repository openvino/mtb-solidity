const { ethers } = require("hardhat");
const { tokens } = require("../utils/tokens");

const { parseEther } = ethers;

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const MTB = await ethers.getContractFactory("MTB");

    
    for (const token of tokens) {
        const capInEther = parseEther(token.cap.toString()); 

        console.log(`Deploying ${token.name} (${token.symbol}) with cap: ${token.cap}`);

        const mtb = await MTB.deploy(token.name, token.symbol, capInEther);
        
        console.log(`${token.name} (${token.symbol}) deployed to:`, mtb.target);
    }

    console.log("All tokens deployed!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });



// const { ethers } = require("hardhat");

// const { parseUnits, parseEther } = ethers;
// async function main() {
//     const [deployer] = await ethers.getSigners();

//     console.log("Deploying contracts with the account:", deployer.address);

//     // Desplegar el contrato con el cap
//     const MTB = await ethers.getContractFactory("MTB");
//     const cap = parseEther("1000000"); 
//     const mtb = await MTB.deploy("MIKETANGOBRAVO18", "MTB18", cap);

//     console.log("MTB deployed to:", mtb.target);
// }

// main()
//     .then(() => process.exit(0))
//     .catch((error) => {
//       console.error(error);
//       process.exit(1);
//     });
