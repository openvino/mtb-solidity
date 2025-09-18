// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract SplitOracle is AccessControl {
    bytes32 public constant ADMIN_ROLE     = DEFAULT_ADMIN_ROLE;
    bytes32 public constant RESETTER_ROLE  = keccak256("RESETTER_ROLE");

    IUniswapV2Pair     public immutable pair;
    IERC20Metadata     public immutable OVI;
    IERC20Metadata     public immutable USDC;

    uint256 public thresholdPrice;   // wei (18 dec)
    uint256 public minOviInPool;     // wei
    uint256 public minDuration;      // seconds

    uint256 public lastPriceRise;    // timestamp
    uint256 public lastOviRise;      // timestamp

    event SplitAllowedChecked(bool allowed);

    /// @notice Updates timers: sets last*Rise when thresholds are met, otherwise resets them.
    function updateState() public {
      // PRICE
      uint256 spot = getSpotPriceWei();
      if (spot >= thresholdPrice) {
        if (lastPriceRise == 0) lastPriceRise = block.timestamp;
      } else {
        lastPriceRise = 0;
      }
      // POOL
      uint256 pool = getOviInPoolRaw();
      if (pool >= minOviInPool) {
        if (lastOviRise == 0) lastOviRise = block.timestamp;
      } else {
        lastOviRise = 0;
      }
    }

    /// @notice Spot price normalized to 18 decimals (USDC per OVI).
    function getSpotPriceWei() public view returns (uint256) {
      (uint112 r0, uint112 r1,) = pair.getReserves();
      bool zeroIsOvi = pair.token0() == address(OVI);
      uint256 oviRes  = zeroIsOvi ? r0 : r1;
      uint256 usdcRes = zeroIsOvi ? r1 : r0;
      uint256 factor  = 10 ** (36 - USDC.decimals());
      return (usdcRes * factor) / oviRes;
    }

    /// @notice OVI amount in the pool (raw reserves value).
    function getOviInPoolRaw() public view returns (uint256) {
      (uint112 r0, uint112 r1,) = pair.getReserves();
      return pair.token0() == address(OVI) ? r0 : r1;
    }

    /// @notice Pure view of split conditions considering duration, without writing state.
    function canSplitView() public view returns (bool) {
      return _priceDurationOk() && _poolDurationOk();
    }

    function checkAllowSplit() external returns (bool) {
      updateState();
      bool ok = canSplitView();
      emit SplitAllowedChecked(ok);
      return ok;
    }

    /// @notice Resets both timers (DAO only).
    function resetRiseTimestamps() external onlyRole(RESETTER_ROLE) {
      lastPriceRise = block.timestamp;
      lastOviRise   = block.timestamp;
    }

    /// @dev Checks only price threshold duration.
    function _priceDurationOk() internal view returns (bool) {
      uint256 spot = getSpotPriceWei();
      if (spot < thresholdPrice) return false;
      if (minDuration == 0)       return true;
      if (lastPriceRise == 0)     return false;
      return block.timestamp - lastPriceRise >= minDuration;
    }
    /// @dev Checks only pool threshold duration.
    function _poolDurationOk() internal view returns (bool) {
      uint256 pool = getOviInPoolRaw();
      if (pool < minOviInPool)    return false;
      if (minDuration == 0)       return true;
      if (lastOviRise == 0)       return false;
      return block.timestamp - lastOviRise >= minDuration;
    }

    /// @notice Price status with elapsed and remaining counters.
    function priceDurationStatus()
      external view
      returns (
        bool ok,
        uint256 elapsed,
        uint256 remaining
      )
    {
      uint256 spot = getSpotPriceWei();
      if (spot < thresholdPrice) {
        return (false, 0, minDuration);
      }
      if (lastPriceRise == 0) {
        return (false, 0, minDuration);
      }
      unchecked {
        elapsed   = block.timestamp - lastPriceRise;
        remaining = elapsed >= minDuration ? 0 : minDuration - elapsed;
      }
      ok = remaining == 0;
    }

    /// @notice Pool status with elapsed and remaining counters.
    function poolDurationStatus()
      external view
      returns (
        bool ok,
        uint256 elapsed,
        uint256 remaining
      )
    {
      uint256 pool = getOviInPoolRaw();
      if (pool < minOviInPool) {
        return (false, 0, minDuration);
      }
      if (lastOviRise == 0) {
        return (false, 0, minDuration);
      }
      unchecked {
        elapsed   = block.timestamp - lastOviRise;
        remaining = elapsed >= minDuration ? 0 : minDuration - elapsed;
      }
      ok = remaining == 0;
    }

    // —— Admin setters
    function setThresholdPrice(uint256 p) external onlyRole(ADMIN_ROLE) {
      thresholdPrice = p;
    }
    function setMinOviInPool(uint256 s) external onlyRole(ADMIN_ROLE) {
      minOviInPool = s;
    }
    function setMinDuration(uint256 d) external onlyRole(ADMIN_ROLE) {
      minDuration = d;
    }
}
