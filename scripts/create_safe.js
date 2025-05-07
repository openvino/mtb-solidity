// 2) Script para desplegar un Safe nuevo

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function createSafe() {
  const [deployer] = await ethers.getSigners();

  console.log("\u2728 Desplegando Gnosis Safe...");

  const GnosisSafeProxyFactory = await ethers.getContractAt(
    "GnosisSafeProxyFactory",
    "0xYourGnosisSafeProxyFactoryAddress"
  );

  const masterCopy = "0xYourGnosisSafeMasterCopyAddress"; // Mastercopy de Safe
  const owners = [
    "0xOwner1Address",
    "0xOwner2Address",
    "0xOwner3Address"
  ];
  const threshold = 2; // Ej: 2 de 3 firmas

  // Setup data
  const safeSingleton = await ethers.getContractAt("GnosisSafe", masterCopy);
  const initializer = safeSingleton.interface.encodeFunctionData("setup", [
    owners,
    threshold,
    ethers.constants.AddressZero,
    "0x",
    ethers.constants.AddressZero,
    ethers.constants.AddressZero,
    0,
    ethers.constants.AddressZero
  ]);

  const tx = await GnosisSafeProxyFactory.createProxy(masterCopy, initializer);
  const receipt = await tx.wait();

  const proxyAddress = receipt.logs[0].address;
  console.log("\u2705 Safe creado en:", proxyAddress);
}