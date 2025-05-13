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
    uint256 public minDuration;      // segs

    uint256 public lastPriceRise;    // ts
    uint256 public lastOviRise;      // ts

    event SplitAllowedChecked(bool allowed);

    constructor(
      address admin,
      address oviToken,
      address usdcToken,
      address pairAddr,
      uint256 _thresholdPrice,
      uint256 _minOviInPool,
      uint256 _minDuration,
      address daoAddress
    ) {
      _grantRole(ADMIN_ROLE, admin);
      _grantRole(RESETTER_ROLE, daoAddress);

      OVI            = IERC20Metadata(oviToken);
      USDC           = IERC20Metadata(usdcToken);
      pair           = IUniswapV2Pair(pairAddr);
      thresholdPrice = _thresholdPrice;
      minOviInPool   = _minOviInPool;
      minDuration    = _minDuration;
    }

    /// @notice Actualiza timers: setea lastXRise si sube, o los reinicia
    function updateState() public {
      // PRECIO
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

    /// @notice Precio spot normalizado a 18 decimales
    function getSpotPriceWei() public view returns (uint256) {
      (uint112 r0, uint112 r1,) = pair.getReserves();
      bool zeroIsOvi = pair.token0() == address(OVI);
      uint256 oviRes  = zeroIsOvi ? r0 : r1;
      uint256 usdcRes = zeroIsOvi ? r1 : r0;
      uint256 factor  = 10 ** (36 - USDC.decimals());
      return (usdcRes * factor) / oviRes;
    }

    /// @notice OVI en pool raw
    function getOviInPoolRaw() public view returns (uint256) {
      (uint112 r0, uint112 r1,) = pair.getReserves();
      return pair.token0() == address(OVI) ? r0 : r1;
    }

    /// @notice View de condiciones con duración sin escribir
    function canSplitView() public view returns (bool) {
      return _priceDurationOk() && _poolDurationOk();
    }

    function checkAllowSplit() external returns (bool) {
      updateState();
      bool ok = canSplitView();
      emit SplitAllowedChecked(ok);
      return ok;
    }

    /// @notice Reinicia timers (solo DAO)
    function resetRiseTimestamps() external onlyRole(RESETTER_ROLE) {
      lastPriceRise = block.timestamp;
      lastOviRise   = block.timestamp;
    }

    /// @dev Chequea solo la duración de precio
    function _priceDurationOk() internal view returns (bool) {
      uint256 spot = getSpotPriceWei();
      if (spot < thresholdPrice) return false;
      if (minDuration == 0)       return true;
      if (lastPriceRise == 0)     return false;
      return block.timestamp - lastPriceRise >= minDuration;
    }
    /// @dev Chequea solo la duración de pool
    function _poolDurationOk() internal view returns (bool) {
      uint256 pool = getOviInPoolRaw();
      if (pool < minOviInPool)    return false;
      if (minDuration == 0)       return true;
      if (lastOviRise == 0)       return false;
      return block.timestamp - lastOviRise >= minDuration;
    }

    /// @notice Estado de precio + contador
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

    /// @notice Estado de pool + contador
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

    // —— Setters admin
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
