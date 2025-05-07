// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./MTB.sol";

contract CrowdsaleOVI {
    MTB public token;
    address payable public wallet;

    uint256 public weiRaised;
    uint256 public cap;

    uint256 public openingTime;
    uint256 public closingTime;
    bool public isFinalized;

    uint256 public phaseOneCap; // Límite en wei para la fase 1
    uint256 public ratePhaseOne; // tokens por wei en la fase 1
    uint256 public ratePhaseTwo; // tokens por wei en la fase 2

    event TokensPurchased(
        address indexed purchaser,
        uint256 value,
        uint256 amount
    );
    event CrowdsaleFinalized();

    constructor(
        address payable _wallet,
        MTB _token,
        uint256 _cap,
        uint256 _openingTime,
        uint256 _closingTime,
        uint256 _phaseOneCap,
        uint256 _ratePhaseOne,
        uint256 _ratePhaseTwo
    ) {
        require(_wallet != address(0), "Wallet is zero address");
        require(address(_token) != address(0), "Token is zero address");
        require(_phaseOneCap <= _cap, "Phase 1 cap exceeds total cap");

        wallet = _wallet;
        token = _token;
        cap = _cap;
        openingTime = _openingTime;
        closingTime = _closingTime;
        phaseOneCap = _phaseOneCap;
        ratePhaseOne = _ratePhaseOne;
        ratePhaseTwo = _ratePhaseTwo;
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
        uint256 newTotal = weiRaised + weiAmount;

        if (weiRaised >= phaseOneCap) {
            // Solo en fase 2
            return weiAmount * ratePhaseTwo;
        } else if (newTotal <= phaseOneCap) {
            // Solo en fase 1
            return weiAmount * ratePhaseOne;
        } else {
            // Parte en fase 1, parte en fase 2
            uint256 weiInPhaseOne = phaseOneCap - weiRaised;
            uint256 weiInPhaseTwo = weiAmount - weiInPhaseOne;

            uint256 tokensPhaseOne = weiInPhaseOne * ratePhaseOne;
            uint256 tokensPhaseTwo = weiInPhaseTwo * ratePhaseTwo;

            return tokensPhaseOne + tokensPhaseTwo;
        }
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

    function getRate() public view returns (uint256) {
        if (weiRaised >= phaseOneCap) {
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
}
