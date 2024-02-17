import { Provider, BN, getProvider, AnchorProvider } from "@coral-xyz/anchor";
import { SPL_TOKEN_PROGRAM_ID, splTokenProgram } from "@coral-xyz/spl-token";
import { createMintToInstruction } from "@solana/spl-token";
import {
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const anchor = require("@coral-xyz/anchor");

const DEFAULT_MINT_DECIMALS = 6;

async function createMintInstructions(
  provider: AnchorProvider,
  authority: PublicKey,
  mint: PublicKey,
  tokenProgram: PublicKey
) {
  const program = splTokenProgram({
    provider,
    programId: tokenProgram,
  });

  const initMintIx = await program.methods
    .initializeMint(DEFAULT_MINT_DECIMALS, authority, authority)
    .accounts({
      mint: mint,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction();

  const instructions = [
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: provider.publicKey,
      newAccountPubkey: mint,
      space: 82,
      lamports: await provider.connection.getMinimumBalanceForRentExemption(82),
      programId: tokenProgram,
    }),
    initMintIx,
  ];
  return instructions;
}

export async function createMint(
  provider: AnchorProvider,
  initialAuthority: PublicKey | undefined,
  tokenProgram: PublicKey
) {
  let authority = initialAuthority;
  if (authority === undefined) {
    authority = provider.publicKey;
  }
  const mint = anchor.web3.Keypair.generate();
  const instructions = await createMintInstructions(
    provider,
    authority,
    mint.publicKey,
    tokenProgram
  );

  const tx = new anchor.web3.Transaction();
  tx.add(...instructions);

  await provider.sendAndConfirm(tx, [mint]);

  return mint.publicKey;
}

export async function mintToAccount(
  provider: AnchorProvider,
  mint: PublicKey,
  destination: PublicKey,
  amount: BN,
  mintAuthority: PublicKey,
  tokenProgram: PublicKey,
  instruction: TransactionInstruction
) {
  const tx = new anchor.web3.Transaction();
  tx.add(
    instruction,
    createMintToInstruction(
      mint, // mint account
      destination, // destination associated token account
      mintAuthority, // authority
      amount.toNumber(), //number of tokens
      [],
      tokenProgram
    )
  );
  await provider.sendAndConfirm(tx, [], { skipPreflight: true });
}

async function createTokenAccountInstrs(
  provider: AnchorProvider,
  newAccountPubkey: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  tokenProgram: PublicKey,
  lamportsRequested: number
) {
  let lamports = lamportsRequested;
  if (lamports === undefined) {
    lamports = await provider.connection.getMinimumBalanceForRentExemption(165);
  }

  const program = splTokenProgram({
    provider,
    programId: tokenProgram,
  });

  const initializeAccountIx = await program.methods
    .initializeAccount()
    .accounts({
      account: newAccountPubkey,
      mint,
      owner,
    })
    .instruction();

  return [
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: provider.publicKey,
      newAccountPubkey,
      space: 165,
      lamports,
      programId: tokenProgram,
    }),
    initializeAccountIx,
  ];
}

export async function createTokenAccount(
  provider: AnchorProvider,
  mint: PublicKey,
  tokenProgram: PublicKey,
  owner: PublicKey
) {
  const vault = anchor.web3.Keypair.generate();
  const tx = new anchor.web3.Transaction();
  tx.add(
    ...(await createTokenAccountInstrs(
      provider,
      vault.publicKey,
      mint,
      owner,
      tokenProgram,
      undefined
    ))
  );
  await provider.sendAndConfirm(tx, [vault]);
  return vault.publicKey;
}

export const toBytes32Array = (b: Buffer): number[] => {
  const buf = Buffer.alloc(32);
  b.copy(buf, 32 - b.length);

  return Array.from(buf);
};

export function toBeBytes(x: number) {
  const y = Math.floor(x / 2 ** 32);
  return Uint8Array.from(
    [y, y << 8, y << 16, y << 24, x, x << 8, x << 16, x << 24].map(
      (z) => z >>> 24
    )
  );
}
