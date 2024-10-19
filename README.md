# Deploying MTB tokens

1) Add .env file and add the desired provider

```
PRIVATE_KEY=

# OP SEPOLIA
PROVIDER=

# Mainnet
PROVIDER_MAINNET=

# Base Sepolia
PROVIDER_BASE_SEPOLIA=

# Base

```
2) 
```shell
npm i
npx hardhat compile
npx hardhat run "scripts/deploy.js" --network targetNetwork
```
