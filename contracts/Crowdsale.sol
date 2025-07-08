// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./OpenVinoToken.sol";

contract Crowdsale {
    OpenVinoToken public token;
    address payable public wallet;

    uint256 public weiRaised;
    uint256 public cap;

    uint256 public openingTime;
    uint256 public closingTime;
    bool public isFinalized;

    uint256 public rate;

    event TokensPurchased(
        address indexed purchaser,
        uint256 value,
        uint256 amount
    );
    event CrowdsaleFinalized();

    constructor(
        address payable _wallet,
        OpenVinoToken _token,
        uint256 _cap,
        uint256 _openingTime,
        uint256 _closingTime,
        uint256 _rate
    ) {
        require(_wallet != address(0), "Wallet is zero address");
        require(address(_token) != address(0), "Token is zero address");

        wallet = _wallet;
        token = _token;
        cap = _cap;
        openingTime = _openingTime;
        closingTime = _closingTime;
        rate = _rate;
    }

    receive() external payable {
        buyTokens();
    }

    modifier onlyWhileOpen() {
        require(isOpen(), "Crowdsale not open");
        _;
    }

    function isOpen() public view returns (bool) {
        return
            block.timestamp >= openingTime &&
            block.timestamp <= closingTime &&
            !isFinalized;
    }

    function getTokenAmount(uint256 weiAmount) public view returns (uint256) {
        return weiAmount * rate;
    }

    function buyTokens() public payable onlyWhileOpen {
        require(!isFinalized, "Crowdsale finalized");

        uint256 weiAmount = msg.value;
        require(weiRaised + weiAmount <= cap, "Cap exceeded");

        uint256 tokensAmount = getTokenAmount(weiAmount);
        require(
            token.balanceOf(address(this)) >= tokensAmount,
            "Not enough tokens in crowdsale"
        );

        weiRaised += weiAmount;

        emit TokensPurchased(msg.sender, weiAmount, tokensAmount);

        require(token.transfer(msg.sender, tokensAmount), "Token transfer failed");
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

    function updateRate(uint256 newRate) external {
        require(msg.sender == wallet, "Only wallet can update rate");
        rate = newRate;
    }

    function getRate() public view returns (uint256) {
        return rate;
    }

    function balanceOf(address account) public view returns (uint256) {
        return token.balanceOf(account);
    }

    function balanceOfCrowdsale() public view returns (uint256) {
        return token.balanceOf(address(this));
    }
}
