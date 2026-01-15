# 🧪 OpenVinoDAO · Architecture & Deployment

This repo contains the governance stack: OVI token (rebasing), gOVI vault (ERC4626 + votes), Timelock, Governor, and SplitOracle. Interactive scripts target Base/Base Sepolia.

---

## 🧩 Architecture at a Glance

OVI (OpenVinoDao) is the base asset. Holders wrap into gOVI to get voting power. Governor uses gOVI votes, Timelock executes. SplitOracle watches the gOVI/quote pool to allow splits; OVI’s `split()` doubles supply when allowed. Timelock/Multisig holds the critical roles.

```
    Users                       Oracle admin / DAO admin
     |                                   |
     v                                   v
 [ OVI (rebasing) ] <---- wrap/unwarp ----> [ gOVI (ERC4626 + Votes) ]
         |                                        |
         | split() (requires SplitOracle ok)      |
         v                                        v
  [ SplitOracle (gOVI/quote pair) ]           [ OpenVinoGovernor ]
                |                                      |
     resetter role -> OVI               proposals/votes -> queue/exec
                |                                      |
                +---------------- [ OpenVinoTimelock ] <---- multisig / executor
```

Key flows:

- Holders deposit OVI into the vault → mint gOVI → delegate → vote in Governor.
- Governor queues/executess via Timelock.
- `REBASER_ROLE` on OVI can call `split()`; it calls the Oracle to check thresholds and resets its timers (DAO has `RESETTER_ROLE` on the oracle).
- gOVI is also the asset for the liquidity pool with the quote token. Reason: OVI rebases (changing balances), which would distort AMM reserves/pricing; gOVI is non-rebasing, so the pool price remains consistent while still representing underlying OVI and carrying voting power.

---

## 🚀 Contracts & Roles

- **OpenVinoDao (OVI)**: rebasing token (split ×2).
  - `DEFAULT_ADMIN_ROLE`: manages oracle and roles.
  - `PAUSER_ROLE`: pauses transfers.
  - `REBASER_ROLE`: can call `split()` (doubles supply if oracle allows).
- **OpenVinoTokenVault (gOVI)**: ERC4626 + ERC20Votes wrapping OVI; no roles.
- **SplitOracle** (gOVI/quote): allows splits when price + liquidity hold for a duration.
  - `DEFAULT_ADMIN_ROLE`: adjusts thresholds.
  - `RESETTER_ROLE`: allows `resetRiseTimestamps()` (the DAO must have it or `split()` reverts).
- **OpenVinoTimelock**: executes queued actions.
  - `TIMELOCK_ADMIN_ROLE`, `PROPOSER_ROLE`, `EXECUTOR_ROLE` (if executor = 0x0, anyone can execute).
- **OpenVinoGovernor**: counts gOVI votes, proposes and routes to Timelock. Owner can tweak voting delay/period/threshold.
- **StandardERC20**: simple OZ ERC20 (for tests).

---

## 🛠️ Deployment Scripts

- `scripts/deploy_dao.js`

  - Prompts names/symbols, minDelay, proposers/executors/admin.
  - Deploys Timelock, OVI, gOVI (vault), Governor.
  - Requires a SplitOracle address; sets it on OVI and grants `RESETTER_ROLE` to the DAO (caller must have oracle admin).
  - Saves `deployments/dao.json` with addresses.

- `scripts/deploy_split_oracle.js`
  - Prompts gOVI/quote pair, gOVI and quote addresses, price threshold, min gOVI in pool, duration, admin.
  - Optionally grants `RESETTER_ROLE` to the OVI (DAO) address provided.
  - Deploys `SplitOracle` and saves `deployments/split_oracle.json`.

Base CLI (copy/paste):

```bash
# Deploy DAO on Base
npx hardhat run scripts/deploy_dao.js --network base

# Deploy SplitOracle on Base
npx hardhat run scripts/deploy_split_oracle.js --network base
```

---

## 🔐 Recommended Role Setup

- Move OVI `DEFAULT_ADMIN_ROLE`, `REBASER_ROLE`, `PAUSER_ROLE` to a multisig/timelock; revoke EOAs.
- On the oracle, give `DEFAULT_ADMIN_ROLE` and `RESETTER_ROLE` to the multisig, and `RESETTER_ROLE` to the OVI contract.
- Timelock:
  - `PROPOSER_ROLE` → Governor.
  - `EXECUTOR_ROLE` → option A: `0x000…0000` (anyone can execute, typical in on-chain governance); option B: a multisig/curated list (más control pero dependes de esos operadores).
  - `ADMIN` → multisig/timelock.

---

## 🧭 Quick Start

```bash
npm install
npx hardhat compile
# 1) Deploy token + vault (OVI + gOVI)
npx hardhat run scripts/deploy_token_stack.js --network baseSepolia
# 2) Create a gOVI/quote pool (Uniswap V2) and add liquidity
# 3) Deploy SplitOracle (needs pair + OVI + quote)
npx hardhat run scripts/deploy_split_oracle.js --network baseSepolia
# Deploy DAO
npx hardhat run scripts/deploy_dao.js --network baseSepolia
```

The DAO deploy script expects an existing SplitOracle address and will call `setOracle`. Use `deployments/dao.json` and `deployments/split_oracle.json` as references.

---

## 🧭 CLI Verification (BaseScan + Blockscout)

```bash
# BaseScan (Etherscan-compatible)
npx hardhat verify --network baseSepolia --force \
  --contract contracts/OpenvinoDao.sol:OpenvinoDao \
  <dao> "<token name>" "<symbol>" <recipient> <admin> <pauser> <rebaser>

npx hardhat verify --network baseSepolia --force \
  --contract contracts/vault/OpenVinoTokenVault.sol:OpenVinoTokenVault \
  <vault> <dao> "Governance OpenVinoDAO" "gOVI"

# Blockscout (no API key needed)
npx hardhat verify blockscout --network baseSepolia \
  --contract contracts/OpenvinoDao.sol:OpenvinoDao \
  <dao> "<token name>" "<symbol>" <recipient> <admin> <pauser> <rebaser>

npx hardhat verify blockscout --network baseSepolia \
  --contract contracts/vault/OpenVinoTokenVault.sol:OpenVinoTokenVault \
  <vault> <dao> "Governance OpenVinoDAO" "gOVI"
```

---


## ℹ️ Notes

- Oracle must target the **gOVI/quote** pair with liquidity (>0) to avoid divide-by-zero.  
- Each `split()` doubles supply; tightly control `REBASER_ROLE` and oracle thresholds.  
- Be transparent about when/how splits are executed.

---

## 🔄 gOVI vs OVI: Ratios and User Journeys

- **Ratios**: gOVI is a non-rebasing wrapper of OVI (ERC4626). The ratio `assetsPerShare`/`sharesPerAsset` reflects how many OVI back each gOVI share. On a split (OVI supply doubles), the vault ratio adjusts automatically: each gOVI represents twice as many OVI as before (assets/share goes up), so holders are not diluted.

- **Buy / LP path (before split)**: User swaps quote → gOVI (gets X gOVI). If they add liquidity, they pair gOVI with quote in the pool. Ratio is 1:1 if vault was empty; otherwise use the current ratio.

- **After a split**: OVI supply doubles; vault’s `assetsPerShare` increases. gOVI balances stay the same, but each gOVI is redeemable for more OVI. Pool pricing stays consistent because gOVI is non-rebasing.

- **Vote path**: User acquires gOVI (swap or wrap OVI), delegates votes (to self or another) and votes in Governor. No need to hold OVI directly for voting; gOVI carries voting power.

- **Unwrap / exit**: User redeems gOVI → receives OVI using current ratio. If coming from LP, they remove liquidity (get gOVI + quote) and optionally unwrap gOVI to OVI.

To reduce user friction, the frontend should offer simple “Buy/Sell” and “Vote” actions that automatically handle wrap/unwrap and delegation in the background, so users never deal with those steps manually.

---




© OpenVinoDAO · 2025
