# Deploying MTB tokens

1) Add .env file and add the desired provider and private key

```
PRIVATE_KEY=
# Base Sepolia
PROVIDER_BASE_SEPOLIA=

# Base
PROVIDER_BASE

# OP SEPOLIA
PROVIDER=

# Mainnet
PROVIDER_MAINNET=


```
2) 
```shell
npm i
npx hardhat compile
npx hardhat run "scripts/deploy.js" --network targetNetwork
```
