# Deploying MTB tokens

1.  Add .env file and private key
2.  Check ./utils/tokens for adjusting token's names, symbols and supply (for this script cap = supply, we will mint all available tokens to the deployer. The values are equal to the current supply of mainnet tokens
    )
3.  Deploy and mint all tokens:

```
       npm i
       npx hardhat compile
       npx hardhat run "scripts/deploy.js" --network base


```

# Deploying Crowdsale

1.  Make sure to configure the wallet that will receive the funds in scripts/deployCrowdsale.js
2.  Make sure to configure the address of the token that will be sold in the crowdsale in scripts/deployCrowdsale.js

```
       npx hardhat run "scripts/deployCrowdsale.js" --network base
```
