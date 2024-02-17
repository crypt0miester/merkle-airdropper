# Merkle Airdropper

Airdrops tokens based on pre computed data. the data would then be computed in a Merkle Root.

The merkle root is the source of data validity, the frontend must have the .json file to make sure that the account matches and the amount also matches. and the verification when claiming will work. otherwise it will fail since the node does not exist.

sample: 
```json
{
    "account": "public address",
    "amount: 100
}
```

the amount must already be multplied by the decimal points for 6 mint decimals it is 1_000_000.

Please test the code througouhly before running. 

Any loss of funds cannot is your own responsibility as this is a one day project done without audits.