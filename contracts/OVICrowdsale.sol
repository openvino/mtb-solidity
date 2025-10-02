// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "./OpenvinoDao.sol";

contract CrowdsaleOVI {
    OpenvinoDao public token;
    address payable public wallet;

    uint256 public weiRaised;
    uint256 public cap;                // Total cap in wei (ETH)

    uint256 public openingTime;
    uint256 public closingTime;
    bool    public isFinalized;

    uint256 public ratePhaseOne;       // USD per token in phase 1 (18 decimals)
    uint256 public ratePhaseTwo;       // USD per token in phase 2 (18 decimals)

    uint256 public tokensSold;         // Counter of tokens sold
    uint256 public phaseOneTokenCap;   // Token limit in phase 1 (in token units, 18 decimals)

    AggregatorV3Interface public priceFeed; // ETH/USD oracle

    event TokensPurchased(address indexed purchaser, uint256 value, uint256 amount);
    event CrowdsaleFinalized();

    constructor(
        address payable       _wallet,
        OpenvinoDao                   _token,
        uint256               _capWei,
        uint256               _openingTime,
        uint256               _closingTime,
        uint256               _phaseOneTokenCap,  // e.g. 400_000 * 1e18
        uint256               _ratePhaseOneUsd,   // e.g. 1.25 * 1e18
        uint256               _ratePhaseTwoUsd,   // e.g. 2.5  * 1e18
        address               _priceFeed
    ) {
        require(_wallet != address(0), "Wallet is zero address");
        require(address(_token) != address(0), "Token is zero address");
        require(_phaseOneTokenCap > 0, "phaseOneTokenCap zero");

        wallet            = _wallet;
        token             = _token;
        cap               = _capWei;
        openingTime       = _openingTime;
        closingTime       = _closingTime;
        phaseOneTokenCap  = _phaseOneTokenCap;
        ratePhaseOne      = _ratePhaseOneUsd;
        ratePhaseTwo      = _ratePhaseTwoUsd;
        priceFeed         = AggregatorV3Interface(_priceFeed);
    }

    receive() external payable {
        buyTokens();
    }

    modifier onlyWhileOpen() {
        require(isOpen(), "Crowdsale not open");
        _;
    }

    function isOpen() public view returns (bool) {
        return block.timestamp >= openingTime
            && block.timestamp <= closingTime
            && !isFinalized;
    }

    /// @dev Returns the amount of tokens to send for `weiAmount` ETH
  function getTokenAmount(uint256 weiAmount) public view returns (uint256) {
        // 1) get ETH/USD price (8 decimals)
        (, int price,,,) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price feed");

        // 2) adjust to 18 decimals
        uint256 ethUsd = uint256(price) * 1e10; // now 18 decimals

        // 3) USD equivalent to weiAmount ETH
        uint256 usdAmount = (weiAmount * ethUsd) / 1e18;

        // calculate tokens at the correct rate
        if (tokensSold >= phaseOneTokenCap) {
            // fully phase 2
            return (usdAmount * 1e18) / ratePhaseTwo;
        }

        // try to use entire amount in phase 1
        uint256 tokensAtOne = (usdAmount * 1e18) / ratePhaseOne;
        if (tokensSold + tokensAtOne <= phaseOneTokenCap) {
            // fully fits in phase 1
            return tokensAtOne;
        }

        // phase crossing: part in phase 1, part in phase 2
        uint256 availablePhaseOne = phaseOneTokenCap - tokensSold;
        // USD consumed in phase 1
        uint256 usdPhaseOne = (availablePhaseOne * ratePhaseOne) / 1e18;
        uint256 usdPhaseTwo = usdAmount - usdPhaseOne;

        uint256 tokensPhaseTwo = (usdPhaseTwo * 1e18) / ratePhaseTwo;
        return availablePhaseOne + tokensPhaseTwo;
    }


    function buyTokens() public payable onlyWhileOpen {
        require(!isFinalized, "Crowdsale finalized");
        uint256 weiAmount = msg.value;
        require(weiRaised + weiAmount <= cap, "Cap exceeded");

        uint256 tokenAmt = getTokenAmount(weiAmount);
        require(token.balanceOf(address(this)) >= tokenAmt, "Not enough tokens");

        // effects
        weiRaised += weiAmount;
        tokensSold += tokenAmt;

        emit TokensPurchased(msg.sender, weiAmount, tokenAmt);

        // transfers
        require(token.transfer(msg.sender, tokenAmt), "Token transfer failed");
        wallet.transfer(weiAmount);
    }

    function finalize() external {
        require(msg.sender == wallet, "Only wallet can finalize");
        require(block.timestamp > closingTime, "Crowdsale not ended");
        require(!isFinalized, "Already finalized");

        isFinalized = true;
        emit CrowdsaleFinalized();

        uint256 remaining = token.balanceOf(address(this));
        if (remaining > 0) {
            token.transfer(wallet, remaining);
        }
    }

    /// @notice Returns the current rate in tokens per USD (18 decimals)
    function getRate() public view returns (uint256) {
        if (tokensSold >= phaseOneTokenCap) {
            return ratePhaseTwo;
        } else {
            return ratePhaseOne;
        }
    }

    function balanceOf(address account) public view returns (uint256) {
        return token.balanceOf(account);
    }

    function balanceOfCrowdsale() public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function getWeiAmount(uint256 tokenAmount) public view returns (uint256) {
    (, int price,,,) = priceFeed.latestRoundData();
    require(price > 0, "Invalid price feed");

    uint256 ethUsd = uint256(price) * 1e10; // Convert from 8 to 18 decimals

    if (tokensSold >= phaseOneTokenCap) {
        // Fully in phase 2
        uint256 usdAmount = (tokenAmount * ratePhaseTwo) / 1e18;
        return (usdAmount * 1e18) / ethUsd;
    }

    uint256 availablePhaseOne = phaseOneTokenCap - tokensSold;
    if (tokenAmount <= availablePhaseOne) {
        // Fully in phase 1
        uint256 usdAmount = (tokenAmount * ratePhaseOne) / 1e18;
        return (usdAmount * 1e18) / ethUsd;
    }

    // Part in phase 1, part in phase 2
    uint256 tokensInPhaseTwo = tokenAmount - availablePhaseOne;

    uint256 usdPhaseOne = (availablePhaseOne * ratePhaseOne) / 1e18;
    uint256 usdPhaseTwo = (tokensInPhaseTwo * ratePhaseTwo) / 1e18;

    uint256 usdTotal = usdPhaseOne + usdPhaseTwo;
    return (usdTotal * 1e18) / ethUsd;
}
function getEthUsdPrice() public view returns (uint256) {
    (, int price,,,) = priceFeed.latestRoundData();
    require(price > 0, "Invalid price feed");
    return uint256(price) * 1e10; // To have 18 decimals
}

}
