// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title GovernanceOpenvinoDAO
 * @notice ERC-4626 vault that wraps the rebasing DAO token and mints non-rebasing governance shares.
 */
contract GovernanceOpenvinoDAO is ERC4626, ERC20Permit, ERC20Votes {
    uint256 private constant RATIO_SCALE = 1e18;

    constructor(
        IERC20 assetToken,
        string memory shareName,
        string memory shareSymbol
    ) ERC20(shareName, shareSymbol) ERC4626(assetToken) ERC20Permit(shareName) {}

    /**
     * @notice Amount of underlying asset backing each share (scaled by 1e18).
     */
    function assetsPerShare() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return RATIO_SCALE;
        return (totalAssets() * RATIO_SCALE) / supply;
    }

    /**
     * @notice Amount of shares per asset unit (scaled by 1e18).
     */
    function sharesPerAsset() external view returns (uint256) {
        uint256 assets = totalAssets();
        if (assets == 0) return RATIO_SCALE;
        return (totalSupply() * RATIO_SCALE) / assets;
    }

    function decimals() public view override(ERC20, ERC4626) returns (uint8) {
        return super.decimals();
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function _convertToShares(uint256 assets, Math.Rounding rounding)
        internal
        view
        override
        returns (uint256)
    {
        uint256 supply = totalSupply();
        if (supply == 0) {
            return assets;
        }
        return Math.mulDiv(assets, supply, totalAssets(), rounding);
    }

    function _convertToAssets(uint256 shares, Math.Rounding rounding)
        internal
        view
        override
        returns (uint256)
    {
        uint256 supply = totalSupply();
        if (supply == 0) {
            return shares;
        }
        return Math.mulDiv(shares, totalAssets(), supply, rounding);
    }
}
