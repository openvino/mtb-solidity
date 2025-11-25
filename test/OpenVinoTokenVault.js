const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OpenVinoTokenVault", function () {
	let deployer;
	let user;
	let other;
	let asset;
	let vault;

	const parse = (value) => ethers.parseUnits(value, 18);

	beforeEach(async function () {
		[deployer, user, other] = await ethers.getSigners();

		const Token = await ethers.getContractFactory("MockRebasingToken");
		asset = await Token.deploy("Mock TOKEN", "mTOKEN");
		await asset.waitForDeployment();

		const Vault = await ethers.getContractFactory("OpenVinoTokenVault");
		vault = await Vault.deploy(await asset.getAddress(), "Wrapped Mock Token", "wmTOKEN");
		await vault.waitForDeployment();

		await asset.mint(user.address, parse("1000"));
	});

	async function depositFromUser(amount) {
		await asset.connect(user).approve(await vault.getAddress(), amount);
		await vault.connect(user).deposit(amount, user.address);
	}

	it("mints shares 1:1 before any rebase", async function () {
		const depositAmount = parse("100");
		await depositFromUser(depositAmount);

		expect(await vault.totalAssets()).to.equal(depositAmount);
		expect(await vault.balanceOf(user.address)).to.equal(depositAmount);

		const sharesToRedeem = depositAmount / 4n;
		await vault.connect(user).redeem(sharesToRedeem, user.address, user.address);

		expect(await asset.balanceOf(user.address)).to.equal(parse("925"));
		expect(await vault.balanceOf(user.address)).to.equal(depositAmount - sharesToRedeem);
		expect(await vault.totalAssets()).to.equal(depositAmount - sharesToRedeem);
	});

	it("captures split by doubling assets per share", async function () {
		const depositAmount = parse("100");
		await depositFromUser(depositAmount);

		const vaultAddress = await vault.getAddress();
		await asset.split([vaultAddress], 2, 1);

		expect(await vault.totalAssets()).to.equal(depositAmount * 2n);
		expect(await vault.assetsPerShare()).to.equal(2n * 10n ** 18n);

		const redeemShares = parse("1");
		await vault.connect(user).redeem(redeemShares, user.address, user.address);

		expect(await asset.balanceOf(user.address)).to.equal(parse("902"));
		expect(await vault.balanceOf(user.address)).to.equal(depositAmount - redeemShares);
		expect(await vault.sharesPerAsset()).to.equal(5n * 10n ** 17n);
	});

	it("supports fractional withdraw", async function () {
		const depositAmount = parse("12.345678901234");
		await depositFromUser(depositAmount);

		const withdrawAssets = parse("0.500000000001");
		const previewShares = await vault.previewWithdraw(withdrawAssets);

		await vault.connect(user).withdraw(withdrawAssets, other.address, user.address);

		expect(previewShares).to.equal(withdrawAssets);
		expect(await asset.balanceOf(other.address)).to.equal(withdrawAssets);
		expect(await vault.totalAssets()).to.equal(depositAmount - withdrawAssets);
	});
});
