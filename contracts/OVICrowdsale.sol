// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./MTB.sol";

contract OVICrowdsale {
    using SafeMath for uint256;

    MTB public token;
    address payable public wallet;

    uint256 public weiRaised;
    uint256 public cap; // en wei
    uint256 public usdRaised; // simulamos el total en USD
    uint256 public ethUsdRate; // precio del ETH en USD (ej: 1 ETH = 2000 USD)

    uint256 public openingTime;
    uint256 public closingTime;
    bool public isFinalized;

    uint256 public constant USD_THRESHOLD = 500000 * 1e18; // 500,000 USD con 18 decimales

    event TokensPurchased(address indexed purchaser, uint256 value, uint256 amount);
    event CrowdsaleFinalized();

    constructor(
        address payable _wallet,
        MTB _token,
        uint256 _cap,
        uint256 _openingTime,
        uint256 _closingTime,
        uint256 _ethUsdRate // Ej: 2000 USD por ETH => pasar 2000 * 1e18
    ) public {
        require(_wallet != address(0), "Wallet is zero address");
        require(address(_token) != address(0), "Token is zero address");

        wallet = _wallet;
        token = _token;
        cap = _cap;
        openingTime = _openingTime;
        closingTime = _closingTime;
        ethUsdRate = _ethUsdRate;
    }

    receive() external payable {
        buyTokens();
    }

    modifier onlyWhileOpen {
        require(block.timestamp >= openingTime && block.timestamp <= closingTime, "Crowdsale not open");
        _;
    }

    function getTokenAmount(uint256 weiAmount) public view returns (uint256 tokenAmount, uint256 usdValue) {
        // Convertimos el wei a USD usando la tasa fija
        uint256 usd = weiAmount.mul(ethUsdRate).div(1 ether); // resultado en USD con 18 decimales

        if (usdRaised.add(usd) <= USD_THRESHOLD) {
            // Fase 1: 1 USD = 2 tokens
            tokenAmount = usd.mul(2);
        } else if (usdRaised >= USD_THRESHOLD) {
            // Fase 2: 1 USD = 1 token
            tokenAmount = usd;
        } else {
            // Transición entre fase 1 y 2: dividimos en dos partes
            uint256 usdAt1 = USD_THRESHOLD.sub(usdRaised);
            uint256 usdAt2 = usd.sub(usdAt1);

            tokenAmount = usdAt1.mul(2).add(usdAt2);
        }

        return (tokenAmount, usd);
    }

    function buyTokens() public payable onlyWhileOpen {
        require(!isFinalized, "Crowdsale finalized");
        uint256 weiAmount = msg.value;
        require(weiRaised.add(weiAmount) <= cap, "Cap exceeded");

        (uint256 tokens, uint256 usd) = getTokenAmount(weiAmount);

        weiRaised = weiRaised.add(weiAmount);
        usdRaised = usdRaised.add(usd);

        emit TokensPurchased(msg.sender, weiAmount, tokens);

        require(token.transfer(msg.sender, tokens), "Token transfer failed");
        wallet.transfer(weiAmount);
    }

    function finalize() external {
        require(block.timestamp > closingTime, "Crowdsale not ended");
        require(!isFinalized, "Already finalized");

        isFinalized = true;
        emit CrowdsaleFinalized();

        // Devolver tokens restantes
        uint256 remaining = token.balanceOf(address(this));
        if (remaining > 0) {
            token.transfer(wallet, remaining);
        }
    }

    // Si deseas actualizar el precio manualmente
    function updateEthUsdRate(uint256 newRate) external {
        require(msg.sender == wallet, "Only wallet can update rate");
        ethUsdRate = newRate;
    }
}


