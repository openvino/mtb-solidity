# Deploying MTB tokens

Before deploying, first deploy minter.

1.  Create .env file and add private key, providers, and apikeys for verifying on etherscan 

2.  Check ./utils/tokens for adjusting token's names, symbols and supply (for this script cap = supply, we will mint all available tokens to the deployer. The values are equal to the current supply of mainnet tokens
    )
3.  Deploy and mint all tokens:

```
       npm i
       npx hardhat compile
       npx hardhat run "scripts/deploy.js" --network base


```
