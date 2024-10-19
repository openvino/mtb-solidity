# Deploying MTB tokens

Before deploying, first deploy minter.

1. Add .env file and add the desired provider and private key and minter

```
PRIVATE_KEY=
# Base Sepolia
PROVIDER_BASE_SEPOLIA=

# Base
PROVIDER_BASE=

# OP SEPOLIA
PROVIDER=

# Mainnet
PROVIDER_MAINNET=

TOKEN_MINTER=

```

2.

```shell
npm i
npx hardhat compile
npx hardhat run "scripts/deployWithMinter.js" --network targetNetwork
```
