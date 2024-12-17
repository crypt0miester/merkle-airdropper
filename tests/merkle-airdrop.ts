import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MerkleAirdrop } from "../target/types/merkle_airdrop";
import { BalanceTree } from "../app/utils/balance_tree";
import {
  createMint,
  mintToAccount,
  toBytes32Array,
} from "../app/utils";
import {
  TOKEN_PROGRAM_ID,
  associatedAddress,
} from "@coral-xyz/anchor/dist/cjs/utils/token";
import { BN } from "bn.js";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  transfer,
} from "@solana/spl-token";

export interface AirdropEntry {
  account: string;
  amount: number;
}

describe("merkle-airdrop", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const merkleAirdropProgram = anchor.workspace
    .MerkleAirdrop as Program<MerkleAirdrop>;

  it("full end to end", async () => {

    // create mint usually the value is already there unless you are testing
    const tokenMint = await createMint(
      provider,
      provider.publicKey,
      TOKEN_PROGRAM_ID
    );
    console.log("tokenMint", tokenMint.toString());

    const amountsByRecipient = [];
    let totalAmount = 0;

    const airdropData: AirdropEntry[] = [];
    // random data for testing
    const maxAmount = 10000
    const minAmount = 100;
    const numAccounts = 40;

    const testAccountKeypair = Keypair.generate();
    airdropData.push({
      account: testAccountKeypair.publicKey.toBase58(),
      amount: 100
    });

    for (let i = 0; i < numAccounts; i++) {
      const randomKeypair = Keypair.generate();
      airdropData.push({
        account: randomKeypair.publicKey.toBase58(),
        amount: Math.floor(Math.random() * (maxAmount - minAmount + 1) + minAmount)
      });
    }

    // expects to be a file of json with object [{ "account": publicKey, "amount": amount}]
    // airdrop data can come be from a json file, check app/utils/airdrop-data.jon
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

    const [airdropState, _stateBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("airdrop_state"), tokenMint.toBuffer(), merkleRoot],
        merkleAirdropProgram.programId
      );
    // first txn: Initialize airdrop
    await merkleAirdropProgram.methods
      .init(toBytes32Array(merkleRoot))
      .accountsPartial({
        authority: provider.publicKey,
        tokenMint,
        airdropState,
        splTokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const airdropAmount = new anchor.BN(1_000_000 * 1_000_000);
    const vault = associatedAddress({ mint: tokenMint, owner: airdropState });
    // second txn: mint tokens (for testing) airdrop
    await mintToAccount(
      provider,
      tokenMint,
      vault,
      airdropAmount,
      provider.publicKey,
      TOKEN_PROGRAM_ID,
      createAssociatedTokenAccountIdempotentInstruction(
        provider.publicKey, // payer
        vault, // owner associated token account
        airdropState, // token ata owner
        tokenMint // mint account
      )
    );

    const testAccount = testAccountKeypair.publicKey;

    const requestAirdropSig = await provider.connection.requestAirdrop(testAccount, 1 * LAMPORTS_PER_SOL)
    await provider.connection.confirmTransaction(requestAirdropSig);
    // index is the index of the account in the file
    const index = amountsByRecipient.findIndex(
      (e) => e.account.toString() === testAccount.toString()
    );
    console.log('index of claimor', index);
    // merkle proof
    const proofStrings: Buffer[] = tree.getProof(
      index,
      amountsByRecipient[index].account,
      amountsByRecipient[index].amount
    );
    const proofBytes: number[][] = proofStrings.map((p) => toBytes32Array(p));

    let verificationData = Buffer.allocUnsafe(8);
    verificationData.writeBigUInt64LE(BigInt(index));

    // the receipt must be here since it is only the first 8 bytes rather than the complete data
    const [receipt] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("receipt"),
        airdropState.toBuffer(),
        testAccount.toBuffer(),
        verificationData,
      ],
      merkleAirdropProgram.programId
    );

    for (const proofElem of proofBytes) {
      verificationData = Buffer.concat([
        verificationData,
        Buffer.from(proofElem),
      ]);
    }
    
    await merkleAirdropProgram.methods
      .claim(
        toBytes32Array(merkleRoot),
        amountsByRecipient[index].amount,
        verificationData
      )
      .accountsPartial({
        payer: provider.wallet.publicKey,
        recipient: testAccount,
        recipientMintAta: associatedAddress({ mint: tokenMint, owner: testAccount }),
        tokenMint,
        receipt,
        airdropState,
        vault,
        splTokenProgram: TOKEN_PROGRAM_ID,
        ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();
      

    await merkleAirdropProgram.methods
      .withdrawFromVault(toBytes32Array(merkleRoot))
      .accountsPartial({
        authority: provider.publicKey,
        authorityMintAta: associatedAddress({
          mint: tokenMint,
          owner: provider.publicKey,
        }),
        tokenMint,
        airdropState,
        vault,
        splTokenProgram: TOKEN_PROGRAM_ID,
        ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();
  });

});
