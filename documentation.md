# MTB Solidity Contracts

## Table of Contents
- [Overview](#overview)
- [Contract Map](#contract-map)
- [Token Contracts](#token-contracts)
  - [OpenVinoToken](#openvinotoken)
  - [OpenvinoDao](#openvinodao)
- [Governance Stack](#governance-stack)
  - [MyGovernor](#mygovernor)
  - [MyTimelock](#mytimelock)
  - [EntitlementRegistryDID](#entitlementregistrydid)
- [Split Control](#split-control)
  - [SplitOracle](#splitoracle)
- [Crowdsales](#crowdsales)
  - [Crowdsale](#crowdsale)
  - [CrowdsaleOVI](#crowdsaleovi)
- [Treasury Utility](#treasury-utility)
  - [Payout](#payout)
- [Key Flows](#key-flows)
- [Deployment & Operations Notes](#deployment--operations-notes)
- [Testing Ideas](#testing-ideas)

## Overview
This repository implements the smart-contract stack for the OpenVino DAO token ecosystem. It covers two ERC-20 compatible tokens (a capped utility token and a rebasing governance token), multisource token distribution via crowdsales, an on-chain oracle that decides when to trigger a token split, and a governance suite composed of a timelock, governor, and entitlement registry. The design targets progressive decentralization: initial operators can configure parameters, but on-chain roles and timelocked governance eventually own all critical levers.

## Contract Map
| Component | File | Purpose |
| --- | --- | --- |
| Utility token | `contracts/OpenVinoToken.sol` | Capped, pausable ERC-20 for general ecosystem use. |
| Governance token | `contracts/OpenvinoDao.sol` | Rebasing ERC-20 with vote tracking and split capability. |
| Split oracle | `contracts/splitsOracle.sol` | Uniswap V2 based oracle that validates split conditions. |
| Governor | `contracts/governor.sol` | Governor module orchestrating proposals and timelocked execution. |
| Timelock | `contracts/timelock.sol` | Enforces execution delay for approved proposals. |
| DID entitlement registry | `contracts/Entitlement.sol` | Timelock-controlled registry mapping DIDs to role grants. |
| Crowdsale (utility token) | `contracts/Crowdsale.sol` | Simple ETH-for-token sale for `OpenVinoToken`. |
| Crowdsale (governance token) | `contracts/OVICrowdsale.sol` | Chainlink-priced sale with phase-based USD targeting. |
| Treasury payouts | `contracts/Payout.sol` | Minimal-ownable ETH forwarder used by governance. |

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
`OpenvinoDao` (`contracts/OpenvinoDao.sol`) is the DAO governance token with built-in supply rebasing:
- Combines ERC-20, `ERC20Votes`, and permit support to integrate with OpenZeppelin governance tooling.
- Implements an OVS (OpenVino Shares) accounting layer: balances and supply are derived from an invariant total share count divided by `_ovsPerFragment`.
- Exposes a `split()` entry point gated by the `REBASER_ROLE`. When triggered, it doubles the token supply and ensures the Uniswap pair syncs after the change.
- Integrates an externally owned `ISplitOracle` to validate split conditions and to reset oracle timers post-rebase.
- Role model: `DEFAULT_ADMIN_ROLE` manages other roles and oracle configuration, `PAUSER_ROLE` toggles transfers, and `REBASER_ROLE` initiates supply splits.
- Override logic keeps vote tracking aligned with the rebasing supply and enforces the pause check at every transfer.
The initial recipient supplied in the constructor receives the entire initial fragment supply (10 million tokens), which then scales via splits.

## Governance Stack
### MyGovernor
`MyGovernor` (`contracts/governor.sol`) wires the governance setup around OpenZeppelin's modular Governor:
- Voting parameters start at 1 block delay, a voting period of 300 blocks, and a 1,000 token proposal threshold; the owner may adjust these values via dedicated setters.
- Quorum is defined as 4% of the recorded voting supply through `GovernorVotesQuorumFraction`.
- Proposals execute through the associated `TimelockController`, enabling queued execution and cancellation.
- Inherits `GovernorCountingSimple` for straightforward for/against/abstain tallies.
- The contract tracks an `owner` (initial deployer) used for parameter updates before governance hands off control.

### MyTimelock
`MyTimelock` (`contracts/timelock.sol`) is a thin wrapper around OpenZeppelin's `TimelockController`.
- Constructor wires minimum delay, proposer list, executor list, and initial admin.
- The timelock should eventually own the major roles of other contracts, ensuring every sensitive action is queued and delayed.

### EntitlementRegistryDID
`EntitlementRegistryDID` (`contracts/Entitlement.sol`) keeps a DID-based allowlist that governance can mutate via the timelock.
- Grants are keyed by DID hash + role and store active windows, revocation data, and proposal description hashes for traceability.
- Only the configured `timelock` may call `upsertGrantByDID`, `revokeGrantByDID`, or `updateTimelock`, enforcing governance control.
- Includes helper getters (`getGrant`, `getGrantByDID`, `isCurrentlyActiveByDID`) to integrate with off-chain services that consume the registry.
This registry enables on-chain proposals to grant or revoke real-world access for DAO contributors in a verifiable way.

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

## Treasury Utility
### Payout
`Payout` (`contracts/Payout.sol`) is a minimalist treasury contract.
- Ownable wrapper that receives ETH and lets the owner forward arbitrary amounts to recipients via `pay`.
- Intended for timelock ownership so approved governance proposals can disburse funds safely.

## Key Flows
- **Governance Execution**: Token holders delegate voting power (via `OpenvinoDao` + `ERC20Votes`) to participate in proposals. Approved proposals queue in `MyTimelock`, wait for the minimum delay, and execute target actions—often mutating roles, oracle parameters, or treasury payouts.
- **Split Lifecycle**: Operators with `REBASER_ROLE` call `split()` on `OpenvinoDao`. The function synchronizes with `SplitOracle`, doubles `_ovsPerFragment`, emits a `Rebase` event, calls `sync()` on the Uniswap pair, and resets oracle timers. Holders see balances double while preserving proportional ownership.
- **Access Grants**: Governance proposals can call `upsertGrantByDID` through the timelock to manage contributor permissions (e.g., admin or SSH roles) tracked on-chain for off-chain consumption.
- **Token Distribution**: The initial supply and any governance-mandated minting flows into the crowdsale contracts (`Crowdsale` / `CrowdsaleOVI`), which in turn distribute tokens to buyers at predetermined rates and forward raised ETH to the treasury wallet.

## Deployment & Operations Notes
- Ensure the timelock is set as the owner/admin for `OpenVinoToken`, `OpenvinoDao` roles, `SplitOracle` admin, and the `Payout` contract soon after deployment to minimize privileged EOAs.
- Configure the `SplitOracle` with realistic thresholds and durations before enabling `REBASER_ROLE` on the DAO; incorrect settings could block or overly accelerate rebases.
- Crowdsales require preloading token balances and approving the wallet address that collects ETH; consider using the timelock to trigger `finalize()` once sale conditions are met.
- Document Chainlink feed addresses per network when deploying `CrowdsaleOVI`, and audit the Uniswap pair address connected to the oracle.

## Testing Ideas
- Unit test rebase math by simulating multiple splits and verifying that proportional balances remain constant across holders.
- Fuzz-test `SplitOracle.updateState()` with varying reserve ratios and timestamps to confirm timer behavior under edge conditions.
- Validate governance parameter updates by asserting only the governor owner (or timelock after transfer) can modify delays and thresholds.
- Run integration tests where a proposal schedules an entitlement change, waits out the timelock, and successfully calls the registry.
- Simulate crowdsale phase transitions, especially the partial fill scenario where a single contribution crosses from phase one to phase two.
