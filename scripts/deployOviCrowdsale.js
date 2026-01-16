import { ethers } from "ethers";
import hre from "hardhat";
const PROVIDER_URL = process.env.PROVIDER_BASE_SEPOLIA;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

async function main() {
  const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const net = await provider.getNetwork();

  const chainId = Number(net.chainId);
  const networkName = chainId === 84532 ? "baseSepolia" : "unknown";

  console.log("🚀 Deploying with account:", wallet.address);

  const tokenAddress = "0x5ffAFdE05eF78C0bE814452f07363D470bf2CA81";

  const artifact = await hre.artifacts.readArtifact("CrowdsaleOVI");

  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet
  );

  const ethCap = ethers.parseEther("500");

  const openingTime = Math.floor(Date.now() / 1000);
  const closingTime = openingTime + 7 * 24 * 60 * 60;

  const phaseOneTokenCap = ethers.parseUnits("10", 18);

  const ratePhaseOne = ethers.parseUnits("0.5", 18);
  const ratePhaseTwo = ethers.parseUnits("1", 18);

  const priceFeed = "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1";

  const crowdsale = await factory.deploy(
    wallet,
    tokenAddress,
    ethCap,
    openingTime,
    closingTime,
    phaseOneTokenCap,
    ratePhaseOne,
    ratePhaseTwo,
    priceFeed
  );

  const crowdsaleAddress = await crowdsale.getAddress();
  console.log("✅ CrowdsaleOVI deployed at:", crowdsaleAddress);

  const verifyCmd = `npx hardhat verify --network ${networkName} ${crowdsaleAddress} ${wallet.address} "${tokenAddress}" "${ethCap}" ${openingTime} ${closingTime} ${phaseOneTokenCap} ${ratePhaseOne} ${ratePhaseTwo} ${priceFeed} --contract contracts/CrowdsaleOVI.sol:CrowdsaleOVI`;

  console.log(verifyCmd);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});
