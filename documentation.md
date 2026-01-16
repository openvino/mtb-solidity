# OpenVinoDAO Solidity Contracts

## Table of Contents
- [Overview](#overview)
- [Architecture at a Glance](#architecture-at-a-glance)
- [Contract Map](#contract-map)
- [Token Contracts](#token-contracts)
  - [OpenVinoToken](#openvinotoken)
  - [OpenvinoDao](#openvinodao)
  - [GovernanceOpenvinoDAO](#governanceopenvinodao)
- [Governance Stack](#governance-stack)
  - [OpenVinoGovernor](#openvinogovernor)
  - [OpenVinoTimelock](#openvinotimelock)
- [Split Control](#split-control)
  - [SplitOracle](#splitoracle)
- [Crowdsales](#crowdsales)
  - [Crowdsale](#crowdsale)
  - [CrowdsaleOVI](#crowdsaleovi)
- [Launch & Issuance Stages](#launch--issuance-stages)
- [Treasury Utility](#treasury-utility)
  - [Payout](#payout)
- [Flows](#flows)
  - [User Flows](#user-flows)
  - [Deployment Order](#deployment-order)
  - [Operational & Governance](#operational--governance)
- [OVI Price History (Derived from gOVI)](#ovi-price-history-derived-from-govi)
- [Deployment & Operations Notes](#deployment--operations-notes)
- [Appendix: Reference Projects (Rebasing + Wrapper Patterns)](#appendix-reference-projects-rebasing--wrapper-patterns)
- [Scripts](#scripts)

## Overview
This repository implements the smart-contract stack for the OpenVino DAO token ecosystem. It covers two ERC-20 compatible tokens (a capped utility token and a rebasing governance token), multisource token distribution via crowdsales, an on-chain oracle that decides when to trigger a token split, and a governance suite composed of a timelock and governor. The design targets progressive decentralization through planned stages (see [Launch & Issuance Stages](#launch--issuance-stages)): initial operators can configure parameters, but on-chain roles and timelocked governance eventually own all critical levers.

## Architecture at a Glance
OVI (OpenVinoDao) is the base asset. Holders wrap into gOVI to get voting power. Governor uses gOVI votes, Timelock executes. SplitOracle watches the gOVI/quote pool to allow splits; OVI’s `split()` doubles supply when allowed. Timelock/Multisig holds the critical roles.

```
    Users                       Oracle admin / DAO admin
     |                                   |
     v                                   v
 [ OVI (rebasing) ] <---- wrap/unwrap ----> [ gOVI (ERC4626 + Votes) ]
         |                                        |
         | split() (requires SplitOracle ok)      |
         v                                        v
  [ SplitOracle (gOVI/quote pair) ]           [ OpenVinoGovernor ]
                |                                      |
     resetter role -> OVI               proposals/votes -> queue/exec
                |                                      |
                +---------------- [ OpenVinoTimelock ] <---- multisig / executor
```

## Contract Map
| Component | File | Purpose |
| --- | --- | --- |
| Utility token | `contracts/OpenVinoToken.sol` | Capped, pausable ERC-20 for general ecosystem use. |
| Governance token | `contracts/OpenvinoDao.sol` | Rebasing ERC-20 with split capability; governance voting now lives on the wrapped `gOVI` shares. |
| Split oracle | `contracts/splitsOracle.sol` | Uniswap V2 based oracle that validates split conditions. |
| Governor | `contracts/governor.sol` | Governor module orchestrating proposals and timelocked execution. |
| Timelock | `contracts/timelock.sol` | Enforces execution delay for approved proposals. |
| Crowdsale (utility token) | `contracts/Crowdsale.sol` | Simple ETH-for-token sale for `OpenVinoToken`. |
| Crowdsale (governance token) | `contracts/OVICrowdsale.sol` | Chainlink-priced sale with phase-based USD targeting. |
| Treasury payouts | `contracts/Payout.sol` | Minimal-ownable ETH forwarder used by governance. |
| Wrapped token vault | `contracts/GovernanceOpenvinoDAO.sol` | ERC-4626 vault that wraps the rebasing token into a non-rebasing wTOKEN. |

## Token Contracts
### OpenVinoToken
The `OpenVinoToken` contract (`contracts/OpenVinoToken.sol`) provides a classic ERC-20 with several extensions:
- Owner-controlled minting bounded by a fixed `cap` and enforced in `_update` via `ERC20Capped`.
- Pause/unpause hooks through `ERC20Pausable` to freeze transfers during incidents.
- User-initiated burning via `ERC20Burnable`.
- EIP-2612 permit support (`ERC20Permit`) for gasless approvals.
- Constructor sanity check to ensure the initial mint does not exceed the cap.
The owner (initially the deployer) is expected to transfer control to the timelock or governance once bootstrapping finishes.

### OpenvinoDao
`OpenvinoDao` (`contracts/OpenvinoDao.sol`) is the DAO token with built-in supply rebasing; voting power is intentionally removed to keep governance insulated from rebase mechanics:
- Combines ERC-20 and permit support (plus pause/burn extensions) without exposing `ERC20Votes`.
- Implements an OVS (OpenVino Shares) accounting layer: balances and supply are derived from an invariant total share count divided by `_ovsPerFragment`.
- `split()` is gated by `REBASER_ROLE` (expected to be the timelock). Each call doubles total supply by halving `_ovsPerFragment`, preserves holder proportions, and simply notifies the oracle to reset its timers—no Uniswap `sync()` call is needed anymore because trading happens through the vault wrapper.
- The oracle interaction is now minimal (`updateState()`, `canSplitView()`, `resetRiseTimestamps()`), providing full rebase gating without hard-wiring a DEX pair.
- Constructor parameters let you set the initial recipient, admin, pauser, and the address that should own `REBASER_ROLE`; this makes it easy to point the contract at yourself in a devnet and then pass the real timelock address in production.
- Override logic enforces the pause check at every transfer while keeping balances derived from OVS accounting.
The initial recipient supplied in the constructor receives the entire initial fragment supply (10 million tokens), which then scales via splits; governance voting happens on the wrapped `gOVI` token instead. This avoids rebase-specific governance vulnerabilities like stale vote checkpoints (rebases do not trigger vote updates), rebase timing manipulation around snapshots, and unintended voting power growth in passive treasury contracts.


### GovernanceOpenvinoDAO
`GovernanceOpenvinoDAO` (`contracts/GovernanceOpenvinoDAO.sol`) is an ERC-4626 wrapper used to expose a non-rebasing token (`gOVI`) to every DEX/Lend integration and to carry governance voting:
- Holds the rebasing DAO token as `asset` and issues ERC-20 + permit shares for deposits (`deposit`, `mint`) and withdrawals (`withdraw`, `redeem`).
- Extends `ERC20Votes` so delegations and snapshots run against a stable supply immune to rebases.
- `assetsPerShare()` / `sharesPerAsset()` expose the real-time ratio so front-ends can compute `price(TOKEN) = price(wTOKEN) / assetsPerShare`.
- Splits automatically show up in the vault because `totalAssets()` reads the DAO token balance—no manual sync is required and Uniswap v2/v3/v4 can list `gOVI` as a plain ERC-20.
This wrapper design fixes the governance issues of rebasing tokens by making voting power depend on stable share balances while still reflecting supply changes through the exchange rate. It also keeps the asset compatible with any Uniswap version (v2/v3/v4) or similar AMM, rather than locking the system to v2.

## Governance Stack
### OpenvinoGovernor
`OpenVinoGovernor` (`contracts/governor.sol`) wires the governance setup around OpenZeppelin's modular Governor, pointing at the `gOVI` votes token:
- Voting parameters start at 1 block delay, a voting period of 300 blocks, and a 1,000 token proposal threshold; the owner may adjust these values via dedicated setters.
- Quorum is defined as 4% of the recorded voting supply through `GovernorVotesQuorumFraction`.
- Proposals execute through the associated `TimelockController`, enabling queued execution and cancellation.
- Inherits `GovernorCountingSimple` for straightforward for/against/abstain tallies.
- The contract tracks an `owner` (initial deployer) used for parameter updates before governance hands off control.

### OpenvinoTimelock
`OpenVinoTimelock` (`contracts/timelock.sol`) is a thin wrapper around OpenZeppelin's `TimelockController`.
- Constructor wires minimum delay, proposer list, executor list, and initial admin.
- The timelock should eventually own the major roles of other contracts, ensuring every sensitive action is queued and delayed.

## Split Control
### SplitOracle
The `SplitOracle` contract (`contracts/splitsOracle.sol`) determines when a supply split is allowed.
- References a Uniswap V2 pair to read reserves and normalize the OVI/USDC price to 18 decimals.
- Tracks two independent timers (`lastPriceRise`, `lastOviRise`) that only advance when both price and pool depth consistently exceed configured thresholds.
- Exposes `updateState()` and `canSplitView()` to refresh and check conditions, plus `checkAllowSplit()` for combined mutation + query with an event trace.
- The `RESETTER_ROLE` (owned by the DAO) may reset timers post-split to prevent immediate consecutive rebases.
- Admin setters (`setThresholdPrice`, `setMinOviInPool`, `setMinDuration`) adjust oracle sensitivity without redeploying.
The oracle interface `ISplitOracle` is intentionally minimal so the DAO contract can interact with alternative implementations if needed.

## Crowdsales
### Crowdsale
`Crowdsale` (`contracts/Crowdsale.sol`) is a simple ETH-priced sale for the capped utility token.
- Accepts direct ETH transfers or `buyTokens()` calls while the sale window is open and the hard cap is not reached.
- Uses a fixed exchange rate and immediately forwards ETH to the configured wallet address.
- Allows the wallet to finalize the sale after the closing time, reclaim unsold tokens, and prevent further purchases.
- Provides read helpers (`isOpen`, `getTokenAmount`, `balanceOfCrowdsale`) for front-end integrations.

### CrowdsaleOVI
`CrowdsaleOVI` (`contracts/OVICrowdsale.sol`) sells the rebasing DAO token using USD-denominated pricing and a Chainlink ETH/USD feed.
- Divides the sale into two phases: phase one until `phaseOneTokenCap` tokens are sold at `ratePhaseOne` USD/token, followed by phase two at `ratePhaseTwo`.
- Converts incoming ETH to USD using `AggregatorV3Interface.latestRoundData()` (8 decimals adjusted to 18) to keep pricing consistent.
- Handles phase boundary cases by allocating the USD contribution across both phases, updating `tokensSold` accordingly.
- Shares the same lifecycle as the basic crowdsale (wallet-controlled finalize, cap enforcement, immediate ETH forwarding).
- Includes helpers for price introspection (`getRate`, `getWeiAmount`, `getEthUsdPrice`).

**Crowdsale stages and deployment**
- Stage 1: initial USD price and phase cap (`ratePhaseOne`, `phaseOneTokenCap`).
- Stage 2: higher USD price once phase 1 cap is reached (`ratePhaseTwo`).
- Deployment flow: deploy the token, deploy the crowdsale with caps/rates + price feed, fund the crowdsale with tokens, then open the sale window.

**Alternative: crowdsale in gOVI**
Early investors may prefer the governance wrapper gOVI instead of OVI, therefore the crowdsale can be structured to sell gOVI directly. This keeps buyers aligned with the token that will trade on Uniswap later and carry voting power. It is optional and can be offered as an alternative to selling OVI.

## Launch & Issuance Stages
The launch is designed around explicit stages rather than fixed dates. Milestones gate when the next phase unlocks:
- **Launch locked**: contracts are deployed, roles assigned, and governance is wired, but issuance is gated until readiness checks pass.
- **Staged crowdsale**: Phase 1 at an initial USD price until the phase cap is reached, then Phase 2 at the next price tier.
- **Liquidity & DAO allocation**: a reserved tranche is used for LP bootstrap and DAO programs; LP pricing is anchored on gOVI/quote.
- **Governance wrapper activation**: gOVI is minted 1:1 when OVI enters the vault or LP, enabling voting and stable AMM pricing.
- **Progressive decentralization**: timelock takes over admin/rebaser roles; treasury actions move to proposal + execution flow.
- **Split readiness**: SplitOracle thresholds and duration define when splits are allowed; rebases stay disabled until conditions hold.

## Treasury Utility
### Payout
`Payout` (`contracts/Payout.sol`) is a minimalist treasury contract.
- Ownable wrapper that receives ETH and lets the owner forward arbitrary amounts to recipients via `pay`.
- Intended for timelock ownership so approved governance proposals can disburse funds safely.
- Purpose: a simple “treasury outbox” for ETH-only payouts (contributors, grants, ops costs) without complex accounting or token logic.
- Scope limits: it does not track budgets, enforce schedules, or manage ERC-20s; it is deliberately dumb and relies on governance process for controls.

## Flows
The flows below summarize the user journey, deployment order, and governance ops. 

### User Flows
**Buy OVI (via gOVI)**  
Quote token → swap for gOVI (DEX) → unwrap gOVI → receive OVI  
`USDC/ETH` → `gOVI` (AMM) → `redeem()` → `OVI`

**Sell OVI (via gOVI)**  
OVI → wrap into gOVI → swap for quote token  
`OVI` → `deposit()` → `gOVI` → (AMM) → `USDC/ETH`

**Vote starting from OVI**  
OVI → wrap into gOVI → delegate votes → vote → (optional) unwrap  
`OVI` → `deposit()` → `gOVI` → `delegate()` → `vote()` → `redeem()`

**Split lifecycle**  
Oracle ok → `split()` (OVI supply ×2) → vault ratio updates → gOVI stays stable  
`SplitOracle` → `OpenvinoDao.split()` → `assetsPerShare` ↑ → LPs unchanged

### Deployment Order
**Token stack**  
Deploy OVI → deploy gOVI vault → set Oracle → grant roles  
`OpenvinoDao` → `GovernanceOpenvinoDAO` → `setOracle()` → `grantRole(...)`

**DAO stack**  
Deploy Timelock → deploy Governor → wire roles  
`OpenVinoTimelock` → `OpenVinoGovernor` → `PROPOSER/EXECUTOR/ADMIN`

**Full-stack demo order (Base/Base Sepolia)**  
1) Deploy token + vault (`deploy_token_stack.js`).  
2) Create a gOVI/quote pool (Uniswap V2) and add liquidity.  
3) Deploy SplitOracle (`deploy_split_oracle.js`) with pair + OVI + quote.  
4) Deploy DAO stack (`deploy_dao.js`) and pass the SplitOracle address.  
Notes: `deploy_dao.js` calls `setOracle()` and grants `RESETTER_ROLE` to the DAO.

### Operational & Governance
**Final operational state**  
OVI rebases via Oracle gate; gOVI is the governance + trading token; Timelock owns all critical roles and the initial admin is removed.  
Roles consolidated under the Timelock:
- `OpenvinoDao`: `DEFAULT_ADMIN_ROLE`, `REBASER_ROLE`, `PAUSER_ROLE`
- `SplitOracle`: `DEFAULT_ADMIN_ROLE`, `RESETTER_ROLE`
- `Payout`: `owner`
- `OpenVinoTimelock`: `TIMELOCK_ADMIN_ROLE` (no external admin)
`OpenvinoDao (rebasing)` + `GovernanceOpenvinoDAO (votes)` + `Timelock (roles)` + `SplitOracle`

**Routine governance**  
Proposal → vote → queue → execute  
`Governor` → `Timelock` → `execute(targets)`

### OVI Price History (Derived from gOVI)
OVI will not be listed directly, so historical OVI price must be derived from gOVI. This will be built later as an indexer/analytics component:
- Source price: time series of `gOVI/quote` from the pool.
- Convert to OVI: `price(OVI) = price(gOVI) / assetsPerShare()`.
- Store/display: a daily (or block-based) history for charts and analytics.
Placeholder flow: `AMM price feed` → `assetsPerShare()` → `OVI price history`.

## Deployment & Operations Notes
- Ensure the timelock is set as the owner/admin for `OpenVinoToken`, `OpenvinoDao` roles, `SplitOracle` admin, and the `Payout` contract soon after deployment to minimize privileged EOAs.
- Configure the `SplitOracle` with realistic thresholds and durations before enabling `REBASER_ROLE` on the DAO; incorrect settings could block or overly accelerate rebases.
- Crowdsales require preloading token balances and approving the wallet address that collects ETH; consider using the timelock to trigger `finalize()` once sale conditions are met.
- Document Chainlink feed addresses per network when deploying `CrowdsaleOVI`, and audit the Uniswap pair address connected to the oracle.
- Token + vault deployment now lives in `scripts/deploy_token_stack.js`; point `DAO_TOKEN_REBASER` at your timelock when going to production so it is the sole caller of `split()`.
- Governance wiring (`OpenVinoTimelock` + `OpenVinoGovernor`) lives in `scripts/deploy_dao.js`. The script accepts `DAO_TOKEN_ADDRESS` if you have already deployed the token stack separately and will grant + optionally revoke the `REBASER_ROLE` as part of the flow.

## Quick Start
```bash
npm install
npx hardhat compile
# 1) Deploy token + vault (OVI + gOVI)
npx hardhat run scripts/deploy_token_stack.js --network baseSepolia
# 2) Create a gOVI/quote pool (Uniswap V2) and add liquidity
# 3) Deploy SplitOracle (needs pair + OVI + quote)
npx hardhat run scripts/deploy_split_oracle.js --network baseSepolia
# 4) Deploy DAO stack
npx hardhat run scripts/deploy_dao.js --network baseSepolia
```

## CLI Verification (BaseScan + Blockscout)
```bash
# BaseScan (Etherscan-compatible)
npx hardhat verify --network baseSepolia --force \
  --contract contracts/OpenvinoDao.sol:OpenvinoDao \
  <dao> "<token name>" "<symbol>" <recipient> <admin> <pauser> <rebaser>

npx hardhat verify --network baseSepolia --force \
  --contract contracts/GovernanceOpenvinoDAO.sol:GovernanceOpenvinoDAO \
  <vault> <dao> "Governance OpenVinoDAO" "gOVI"

# Blockscout (no API key needed)
npx hardhat verify blockscout --network baseSepolia \
  --contract contracts/OpenvinoDao.sol:OpenvinoDao \
  <dao> "<token name>" "<symbol>" <recipient> <admin> <pauser> <rebaser>

npx hardhat verify blockscout --network baseSepolia \
  --contract contracts/GovernanceOpenvinoDAO.sol:GovernanceOpenvinoDAO \
  <vault> <dao> "Governance OpenVinoDAO" "gOVI"
```

## Appendix: Reference Projects (Rebasing + Wrapper Patterns)
This section summarizes external projects that use a rebasing token plus a non-rebasing wrapper, with notes on what is distinctive about each approach and direct documentation links.

### Ampleforth (AMPL / wAMPL)
- Distinctive approach: AMPL is a classic elastic-supply token that rebases balances; wAMPL is the canonical non-rebasing wrapper used in AMMs and DeFi integrations to avoid reserve drift.
- Mechanism usage: users wrap AMPL into wAMPL, which keeps balances fixed while the exchange rate changes with each rebase.
- Docs: https://docs.ampleforth.org/
- AMPL protocol overview: https://docs.ampleforth.org/learn/about-the-ampleforth-protocol
- wAMPL (wrapper): https://docs.ampleforth.org/learn/about-wrapped-ampl

### Olympus (sOHM / gOHM)
- Distinctive approach: sOHM rebases as staking rewards accrue; gOHM is a non-rebasing wrapper that tracks the index and is favored for governance and LPs.
- Mechanism usage: users wrap sOHM into gOHM so balances stay constant while value per unit increases.
- Docs: https://docs.olympusdao.finance/
- Tokens overview: https://docs.olympusdao.finance/main/overview/tokens/

### Lido (stETH / wstETH)
- Distinctive approach: stETH is rebasing as staking rewards are distributed; wstETH is the non-rebasing wrapper optimized for AMMs and integrations.
- Mechanism usage: users wrap stETH into wstETH; balance stays fixed and the conversion rate rises with staking rewards.
- Docs: https://docs.lido.fi/
- Lido core contract (stETH): https://docs.lido.fi/contracts/lido/
- wstETH (wrapper): https://docs.lido.fi/contracts/wsteth/
- Token integration guide: https://docs.lido.fi/guides/lido-tokens-integration-guide/

### Frax (frxETH / sfrxETH)
- Distinctive approach: frxETH is the liquid token; sfrxETH is a vault share token (not rebasing) with yield reflected in the share value, following the same pattern used for AMM compatibility.
- Mechanism usage: users deposit frxETH to mint sfrxETH; balances stay fixed while the redeemable value per share rises.
- Docs: https://docs.frax.finance/
- frxETH + sfrxETH overview: https://docs.frax.finance/frax-ether/frxeth-and-sfrxeth
- Token addresses: https://docs.frax.finance/frax-ether/frxeth-and-sfrxeth-token-addresses


## Scripts
Scripts live under `scripts/` and most of them rely on the Hardhat runtime. Before running any of them:
- Make sure dependencies are installed with `npm install`.
- Populate `.env` with at least `PRIVATE_KEY` and the RPC URLs you expect to use (`PROVIDER_MAINNET`, `PROVIDER_BASE`, or the corresponding `NEXT_PUBLIC_*` variants).

Use Hardhat for scripts that import `require("hardhat")` or `ethers` from the Hardhat environment:
- `npx hardhat run scripts/<script-name>.js` executes using the default network (derived from your `.env`).
- `npx hardhat run scripts/<script-name>.js --network <network>` targets a named network from `hardhat.config.js`.

If a script is plain Node.js (no Hardhat imports), you can run it with `node scripts/<script-name>.js`. Check the first lines of the file to confirm which runtime it expects.

Before pointing a script at mainnet, review any hard-coded addresses and consider dry-running on a testnet.

Useful deployment entry points:
- `deploy_token_stack.js` → Deploys the rebasing DAO token plus the ERC-4626 vault. Configure `DAO_TOKEN_RECIPIENT`, `DAO_TOKEN_ADMIN`, `DAO_TOKEN_PAUSER`, and `DAO_TOKEN_REBASER` (the latter should be your timelock in production, but can be your own EOA while testing).
- `deploy_dao.js` → Deploys (or reuses) the timelock and governor. If you already have the token deployed, set `DAO_TOKEN_ADDRESS`. The script will make sure the timelock is the only `REBASER_ROLE` holder when `REVOKE_DEPLOYER_REBASER=true`.
