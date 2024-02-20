import * as anchor from "@coral-xyz/anchor";
import { Program, Provider } from "@coral-xyz/anchor";
import assert from "assert";
import { MerkleAirdrop } from "../target/types/merkle_airdrop";
import { BalanceTree } from "./utils/balance_tree";
import {
  createMint,
  createTokenAccount,
  mintToAccount,
  toBeBytes,
  toBytes32Array,
} from "./utils";
import {
  TOKEN_PROGRAM_ID,
  associatedAddress,
} from "@coral-xyz/anchor/dist/cjs/utils/token";
import { BN } from "bn.js";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent,
  createAssociatedTokenAccountIdempotentInstruction,
  createAssociatedTokenAccountInstruction,
  transfer,
} from "@solana/spl-token";
import dotenv from "dotenv";
dotenv.config();
import airdropData from "./amounts.json";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

const CLAIMOR_KEY = process.env.KEY;
const claimorTestKeypair = Keypair.fromSecretKey(bs58.decode(CLAIMOR_KEY));
async function main() {
  const connection = new anchor.web3.Connection(
    "https://api.devnet.solana.com/",
    { commitment: "finalized" }
  );
  const wallet = anchor.Wallet.local();

  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "finalized",
    preflightCommitment: "finalized",
    skipPreflight: false,
  });
  const merkleAirdropProgram = anchor.workspace
    .MerkleAirdrop as Program<MerkleAirdrop>;
  // create mint usually the value is already there unless you are testing
  //   const tokenMint = await createMint(
  //     provider,
  //     provider.publicKey,
  //     TOKEN_PROGRAM_ID
  //   );
  const tokenMint = new PublicKey(
    "2LgNBB7sNcGnGegNkWkstZhQD1y262PcYqueew1yZgt4"
  );
  console.log("tokenMint", tokenMint.toString());

  const amountsByRecipient = [];
  let totalAmount = 0;
  // expects to be a file of json with object [{ "account": publicKey, "amount": amount}]
  // @ts-ignore
  for (const line of airdropData) {
    const { account, amount } = line;
    totalAmount += Number(amount );
    amountsByRecipient.push({
      account: new PublicKey(account),
      // the amount must be multiplied by decimal points
      amount: new anchor.BN(Number(amount * Math.pow(10,6))),
    });
  }
  console.log({totalAmount})
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
  const latestBlockHash = await connection.getLatestBlockhash();
  const tx = new anchor.web3.Transaction({
    recentBlockhash: latestBlockHash.blockhash,
  });
  tx.add(initIx);
  await provider.sendAndConfirm(tx, []);

  const airdropAmount = new anchor.BN(totalAmount* Math.pow(10,6));
  console.log({airdropAmount})
  const airdropAta = associatedAddress({
    mint: tokenMint,
    owner: provider.publicKey,
  });

  // second txn: mint tokens (for testing) airdrop
  await mintToAccount(
    provider,
    tokenMint,
    airdropAta,
    airdropAmount,
    provider.publicKey,
    TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountIdempotentInstruction(
      provider.publicKey, // payer
      airdropAta, // owner associated token account
      provider.publicKey, // token ata owner
      tokenMint // mint account
    )
  );

  const vault = associatedAddress({ mint: tokenMint, owner: airdropState });

  const latestBlockHashAta = await connection.getLatestBlockhash();
  // third txn: create ata (for testing) airdrop
  const txAta = new anchor.web3.Transaction({
    recentBlockhash: latestBlockHashAta.blockhash,
  });
  txAta.add(
    createAssociatedTokenAccountIdempotentInstruction(
      provider.publicKey, // payer
      vault, // owner associated token account
      airdropState, // token ata owner
      tokenMint // mint account
    )
  );
  await provider.sendAndConfirm(txAta, []);

  // fourth txn: transfer tokens from mint authority (for testing) airdrop
  await transfer(
    connection,
    wallet.payer,
    airdropAta,
    vault,
    wallet.payer,
    airdropAmount.toNumber(),
    []
  );

  // index is the index of the account in the file
  const testAccount = claimorTestKeypair.publicKey;
  const index = amountsByRecipient.findIndex(
    (e) => e.account.toString() === testAccount.toString()
  );
  console.log(claimorTestKeypair.publicKey)
  console.log('index of claimor', index);

//  return
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
  const [receipt, _receiptBump] = anchor.web3.PublicKey.findProgramAddressSync(
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
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400_000,
  });
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
      treasury: new PublicKey("HF3CBT9JFfgN3S61JWAduB8mT2SmsgtRihFZvnyvjQQK"),
      receipt,
      airdropState,
      vault,
      splTokenProgram: TOKEN_PROGRAM_ID,
      ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .signers([claimorTestKeypair])
    .instruction();

  const latestBlockHashClaim = await connection.getLatestBlockhash();
  const txClaim = new anchor.web3.Transaction({
    recentBlockhash: latestBlockHashClaim.blockhash,
  });
  txClaim.add(...[computeBudgetIx, claimIxn]);
  await provider.sendAndConfirm(txClaim, [claimorTestKeypair]);
  console.log(merkleRoot);
  console.log(verificationData);

  const withdrawIxn = await merkleAirdropProgram.methods
    .withdrawFromVault(toBytes32Array(merkleRoot))
    .accounts({
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
    .signers([claimorTestKeypair])
    .instruction();

  const latestBlockHashWithdraw = await connection.getLatestBlockhash();
  const txWithdraw = new anchor.web3.Transaction({
    recentBlockhash: latestBlockHashWithdraw.blockhash,
  });
  txWithdraw.add(withdrawIxn);
  await provider.sendAndConfirm(txWithdraw, []);
}

main();
