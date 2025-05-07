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
4.  If verification fails (change the parameters to match the deployed token):

```
 npx hardhat verify --network base --contract contracts/mtb.sol:MTB 0xA4972a46D2a49AbE6E5EE7406cEB7A779A1dA185 "MikeTangoBravo25" "MTB25" 1024000000000000000000 1024000000000000000000

```





# Deploying Crowdsale

1.  Make sure to configure the wallet that will receive the funds in scripts/deployCrowdsale.js
2.  Make sure to configure the address of the token that will be sold in the crowdsale in scripts/deployCrowdsale.js

```
       npx hardhat run "scripts/deployCrowdsale.js" --network base
```
