// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

/// @notice SplitOracle minumum interface
interface ISplitOracle {
    function updateState() external;
    function canSplitView() external view returns (bool);
    function resetRiseTimestamps() external;
    function pair() external view returns (IUniswapV2Pair);
}

contract OpenvinoDao is
    ERC20,
    ERC20Burnable,
    ERC20Pausable,
    ERC20Permit,
    ERC20Votes,
    AccessControl
{
    bytes32 public constant PAUSER_ROLE  = keccak256("PAUSER_ROLE");
    bytes32 public constant REBASER_ROLE = keccak256("REBASER_ROLE");

    // —— Rebase internals (“OVS”) ——
    uint256 public constant INITIAL_FRAGMENTS_SUPPLY = 10_000_000 * 10**18;
    uint256 private constant TOTAL_OVS =
        type(uint128).max - (type(uint128).max % INITIAL_FRAGMENTS_SUPPLY);

    uint256 private _ovsPerFragment;
    mapping(address => uint256) private _ovsBalances;

    // —— Oracle ——
    ISplitOracle public oracle;
    event OracleSet(address indexed newOracle);

    // —— Rebase event ——
    event Rebase(uint256 oldSupply, uint256 newSupply);

    constructor(
        address recipient,
        address defaultAdmin,
        address pauser
    )
        ERC20("OpenvinoDao", "OVI")
        ERC20Permit("OpenvinoDao")
    {
        // 1) Assign roles
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(REBASER_ROLE, defaultAdmin);

        // 2) Initialize rebase accounting
        _ovsPerFragment = TOTAL_OVS / INITIAL_FRAGMENTS_SUPPLY;
        _ovsBalances[recipient] = INITIAL_FRAGMENTS_SUPPLY * _ovsPerFragment;
        emit Transfer(address(0), recipient, INITIAL_FRAGMENTS_SUPPLY);
    }

    /// @notice Set the SplitOracle address; only admin can call
    function setOracle(address oracleAddress)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        oracle = ISplitOracle(oracleAddress);
        emit OracleSet(oracleAddress);
    }

    /// @notice Perform a split (rebase ×2) if oracle allows; then sync & reset oracle timers
    function split()
        external
        onlyRole(REBASER_ROLE)
    {
        require(address(oracle) != address(0), "Oracle not set");

        // 1) Refresh oracle internal state
        oracle.updateState();
        require(oracle.canSplitView(), "Split not allowed");

        // 2) Rebase: double supply
        uint256 oldSupply = totalSupply();
        uint256 newSupply = oldSupply * 2;
        require(newSupply > oldSupply, "split overflow");
        _ovsPerFragment = TOTAL_OVS / newSupply;
        emit Rebase(oldSupply, newSupply);

        // 3) Sync Uniswap V2 pair so reserves reflect the rebase
        IUniswapV2Pair pool = oracle.pair();
        pool.sync();

        // 4) Reset oracle timers to block immediate subsequent splits
        oracle.resetRiseTimestamps();
    }

    /// @notice Pause all transfers
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Unpause transfers
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @dev totalSupply derived from OVS accounting
    function totalSupply() public view override(ERC20) returns (uint256) {
        return TOTAL_OVS / _ovsPerFragment;
    }

    /// @dev balanceOf derived from OVS accounting
    function balanceOf(address account)
        public
        view
        override(ERC20)
        returns (uint256)
    {
        return _ovsBalances[account] / _ovsPerFragment;
    }

    /// @dev Unified hook for transfer/mint/burn + votes, using OVS units
    function _update(
        address from,
        address to,
        uint256 amount
    )
        internal
        virtual
        override(ERC20, ERC20Pausable, ERC20Votes)
    {
        require(!paused(), "Pausable: paused");

        uint256 ovsValue = amount * _ovsPerFragment;

        if (from != address(0)) {
            uint256 bal = _ovsBalances[from];
            require(bal >= ovsValue, "Rebase: insufficient");
            unchecked { _ovsBalances[from] = bal - ovsValue; }
        }
        if (to != address(0)) {
            _ovsBalances[to] += ovsValue;
        }

        emit Transfer(from, to, amount);
        _transferVotingUnits(from, to, amount);
    }

    /// @dev nonces for ERC20Permit
    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
