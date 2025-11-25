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

/// @notice Legacy SplitOracle interface (includes Uniswap pair dependency)
interface ISplitOracleLegacy {
    function updateState() external;
    function canSplitView() external view returns (bool);
    function resetRiseTimestamps() external;
    function pair() external view returns (IUniswapV2Pair);
}

/**
 * @dev Legacy implementation kept for reference/testing. New deployments should use `OpenvinoDao`.
 */
contract OpenvinoDaoLegacy is
    ERC20,
    ERC20Burnable,
    ERC20Pausable,
    ERC20Permit,
    ERC20Votes,
    AccessControl
{
    bytes32 public constant PAUSER_ROLE  = keccak256("PAUSER_ROLE");
    bytes32 public constant REBASER_ROLE = keccak256("REBASER_ROLE");

    uint256 public constant INITIAL_FRAGMENTS_SUPPLY = 10_000_000 * 10**18;
    uint256 private constant TOTAL_OVS =
        type(uint128).max - (type(uint128).max % INITIAL_FRAGMENTS_SUPPLY);

    uint256 private _ovsPerFragment;
    mapping(address => uint256) private _ovsBalances;

    ISplitOracleLegacy public oracle;
    event OracleSet(address indexed newOracle);
    event Rebase(uint256 oldSupply, uint256 newSupply);

    constructor(
        address recipient,
        address defaultAdmin,
        address pauser
    )
        ERC20("OpenvinoDao", "OVI")
        ERC20Permit("OpenvinoDao")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(REBASER_ROLE, defaultAdmin);

        _ovsPerFragment = TOTAL_OVS / INITIAL_FRAGMENTS_SUPPLY;
        _ovsBalances[recipient] = INITIAL_FRAGMENTS_SUPPLY * _ovsPerFragment;
        emit Transfer(address(0), recipient, INITIAL_FRAGMENTS_SUPPLY);
    }

    function setOracle(address oracleAddress)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        oracle = ISplitOracleLegacy(oracleAddress);
        emit OracleSet(oracleAddress);
    }

    function split()
        external
        onlyRole(REBASER_ROLE)
    {
        require(address(oracle) != address(0), "Oracle not set");

        oracle.updateState();
        require(oracle.canSplitView(), "Split not allowed");

        uint256 oldSupply = totalSupply();
        uint256 newSupply = oldSupply * 2;
        require(newSupply > oldSupply, "split overflow");
        _ovsPerFragment = TOTAL_OVS / newSupply;
        emit Rebase(oldSupply, newSupply);

        IUniswapV2Pair pool = oracle.pair();
        pool.sync();

        oracle.resetRiseTimestamps();
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function totalSupply() public view override(ERC20) returns (uint256) {
        return TOTAL_OVS / _ovsPerFragment;
    }

    function balanceOf(address account)
        public
        view
        override(ERC20)
        returns (uint256)
    {
        return _ovsBalances[account] / _ovsPerFragment;
    }

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

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
