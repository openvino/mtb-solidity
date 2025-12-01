import readline from "readline";
import fs from "fs";
import path from "path";
import pkg from "hardhat";
import { findBuildInfo, writeVerifyFiles } from "./utils/verifyArtifacts.js";

const { ethers } = pkg;

function prompt() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q, d = "") =>
    new Promise((res) => rl.question(`${q}${d ? ` (${d})` : ""}: `, (ans) => res((ans || d).trim())));
  const close = () => rl.close();
  return { ask, close };
}

async function main() {
  const { ask, close } = prompt();
  try {
    const [signer] = await ethers.getSigners();
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Deployer:", signer.address);

    const pair = await ask("Dirección del par Uniswap (OVI/USDC)");
    const ovi = await ask("Dirección del token OVI");
    const usdc = await ask("Dirección del token USDC");
    const usdcDecimalsStr = await ask("Decimales de USDC", "6");
    const thresholdStr = await ask("Precio mínimo USDC por OVI (ej 1.20)", "1");
    const minPoolStr = await ask("Mínimo OVI en pool (entero OVI)", "10000");
    const durationStr = await ask("Duración mínima en segundos", "3600");
    const admin = await ask("Admin (DEFAULT_ADMIN y RESETTER)", signer.address);
    const daoAddress = await ask("Dirección del OVI (DAO) para darle RESETTER_ROLE (opcional)", "");

    const usdcDecimals = Number(usdcDecimalsStr);
    const threshold = ethers.parseUnits(thresholdStr, 18);
    const minPool = ethers.parseUnits(minPoolStr, 18);
    const duration = BigInt(durationStr);

    const Factory = await ethers.getContractFactory("SplitOracle");
    const oracle = await Factory.deploy(pair, ovi, usdc, threshold, minPool, duration, admin);
    await oracle.waitForDeployment();
    const addr = await oracle.getAddress();
    console.log("SplitOracle deployed at:", addr);

    // Opcional: otorgar RESETTER_ROLE al contrato OVI (DAO)
    if (daoAddress) {
      try {
        const resetter = await oracle.RESETTER_ROLE();
        const tx = await oracle.grantRole(resetter, daoAddress);
        await tx.wait();
        console.log("RESETTER_ROLE otorgado al DAO:", daoAddress);
      } catch (err) {
        console.warn("No se pudo otorgar RESETTER_ROLE al DAO:", err);
      }
    }

    const outPath = path.join(process.cwd(), "deployments", "split_oracle.json");
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        {
          network: (await ethers.provider.getNetwork()).name,
          address: addr,
          pair,
          ovi,
          usdc,
          usdcDecimals,
          threshold: threshold.toString(),
          minPool: minPool.toString(),
          duration: duration.toString(),
          admin,
          deployer: signer.address,
          daoResetter: daoAddress,
        },
        null,
        2
      )
    );
    console.log("📁 Guardado en", outPath);

    // Guardar build-info y Standard JSON
    const bi = findBuildInfo("contracts/splitsOracle.sol", "SplitOracle");
    const { buildInfoFile, standardJsonInputFile } = writeVerifyFiles({
      scriptLabel: "deploy_split_oracle",
      label: "split_oracle",
      address: addr,
      buildInfoData: bi?.data,
    });
    console.log("Build-info:", buildInfoFile, "| Standard JSON:", standardJsonInputFile);

    // Comando de verificación manual
    const verifyDir = path.join(process.cwd(), "deployments", "verify", "deploy_split_oracle");
    const verifyFile = path.join(
      verifyDir,
      `split_oracle_verify_${addr}.json`
    );
    fs.writeFileSync(
      verifyFile,
      JSON.stringify(
        {
          contract: "contracts/splitsOracle.sol:SplitOracle",
          address: addr,
          constructorArgs: [
            pair,
            ovi,
            usdc,
            threshold.toString(),
            minPool.toString(),
            duration.toString(),
            admin,
          ],
          buildInfoFile,
          standardJsonInputFile,
          note: "Use BaseScan manual verify with compiler v0.8.22+commit.4fc1097e, optimizer 1, runs 200, evm Paris",
        },
        null,
        2
      )
    );
    console.log("Verify helper:", verifyFile);
  } finally {
    close();
  }
}

main().catch((err) => {
  console.error("❌ Error en el deploy:", err);
  process.exitCode = 1;
});
