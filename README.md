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

all the data needed is in the app folder

# How to use
1. prepare list of accounts with amounts like in sample above. or like in [airdrop-data.json](app/airdrop-data.json)
2. create a balance tree and merkle root

```ts
  const amountsByRecipient = [];
  let totalAmount = 0;
  // expects to be a file of json with object [{ "account": publicKey, "amount": amount}]
  for (const line of airdropData) {
    const { account, amount } = line;
    totalAmount += Number(amount);
    amountsByRecipient.push({
      account: new PublicKey(account),
      // the amount must be multiplied by decimal points
      amount: new anchor.BN(Number(amount)),
    });
  }
  // balance tree of the airdrop data
  const tree = new BalanceTree(amountsByRecipient);
  // merkle root tree
  const merkleRoot = tree.getRoot();

```
3. run initIxn, the second argument in init is if the token is a token2022 or not

```ts

  const initIx = await merkleAirdropProgram.methods
    .init(toBytes32Array(merkleRoot), false)
    .accounts({
      authority: provider.publicKey,
      tokenMint,
      airdropState,
      splTokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

```
4. send tokens to Airdrop State account
5. users in the airdrop-data.json can now claim their tokens. the claim instruction creates an ata if it doesn't exist. the amount + index must be computed from the airdrop-data.json
```ts

  // index is the index of the account/publickey in the file
  const index = 0;
  // merkle proof
  const proofStrings: Buffer[] = tree.getProof(
    index,
    amountsByRecipient[index].account,
    amountsByRecipient[index].amount
  );
  const proofBytes: number[][] = proofStrings.map((p) => toBytes32Array(p));

  let verificationData = Buffer.allocUnsafe(8);
  verificationData.writeBigUInt64LE(BigInt(index));

  const testAccount = userPublicKey;

  // the receipt must be here since it is only the first 8 bytes rather than the complete data
  const [receipt, _receiptBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("receipt"), testAccount.toBuffer(), verificationData],
    merkleAirdropProgram.programId
  );

  for (const proofElem of proofBytes) {
    verificationData = Buffer.concat([
      verificationData,
      Buffer.from(proofElem),
    ]);
  }

  // last transaction: Claim instruction 
  const claimIxn = await merkleAirdropProgram.methods
    .claim(
      toBytes32Array(merkleRoot),
      amountsByRecipient[index].amount,
      verificationData
    )
    .accounts({
      owner: testAccount,
      ownerMintAta: associatedAddress({
        mint: tokenMint,
        owner: testAccount,
      }),
      tokenMint,
      receipt,
      airdropState,
      vault,
      splTokenProgram: TOKEN_PROGRAM_ID,
      ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .signers([claimorTestKeypair])
    .instruction();
```

5. claimors will not be able to claim again because we create a reciept based on their data.