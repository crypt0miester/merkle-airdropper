"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const anchor = __importStar(require("@coral-xyz/anchor"));
const balance_tree_1 = require("./utils/balance_tree");
const utils_1 = require("./utils");
const token_1 = require("@coral-xyz/anchor/dist/cjs/utils/token");
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const amounts_json_1 = __importDefault(require("./amounts.json"));
const bytes_1 = require("@coral-xyz/anchor/dist/cjs/utils/bytes");
const CLAIMOR_KEY = process.env.KEY;
const claimorTestKeypair = web3_js_1.Keypair.fromSecretKey(bytes_1.bs58.decode(CLAIMOR_KEY));
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const connection = new anchor.web3.Connection("https://frequent-newest-bridge.solana-devnet.quiknode.pro/97a9f5280335ef4fd9763fb079ba0d06be96c06f/", { commitment: "finalized" });
        const wallet = anchor.Wallet.local();
        const provider = new anchor.AnchorProvider(connection, wallet, {
            commitment: "finalized",
            preflightCommitment: "finalized",
            skipPreflight: false,
        });
        const merkleAirdropProgram = anchor.workspace
            .MerkleAirdrop;
        // create mint usually the value is already there unless you are testing
        /*const tokenMint = await createMint(
         provider,
         provider.publicKey,
         TOKEN_PROGRAM_ID
       );
       */
        const tokenMint = new web3_js_1.PublicKey("LGNDWdLatceN2Td6yK6kA9A34HF489ZJ3RR6n7QqUxG");
        console.log("tokenMint", tokenMint.toString());
        const amountsByRecipient = [];
        let totalAmount = 0;
        // expects to be a file of json with object [{ "account": publicKey, "amount": amount}]
        // @ts-ignore
        for (const line of amounts_json_1.default) {
            const { account, amount } = line;
            totalAmount += Number(amount);
            amountsByRecipient.push({
                account: new web3_js_1.PublicKey(account),
                // the amount must be multiplied by decimal points
                amount: new anchor.BN(Number(amount * Math.pow(10, 9))),
            });
        }
        console.log({ totalAmount });
        // balance tree of the airdrop data
        const tree = new balance_tree_1.BalanceTree(amountsByRecipient);
        // merkle root tree
        const merkleRoot = tree.getRoot();
        const [airdropState, _stateBump] = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("airdrop_state"), tokenMint.toBuffer(), merkleRoot], merkleAirdropProgram.programId);
        // first txn: Initialize airdrop
        const initIx = yield merkleAirdropProgram.methods
            .init((0, utils_1.toBytes32Array)(merkleRoot), false)
            .accounts({
            authority: provider.publicKey,
            tokenMint,
            airdropState,
            splTokenProgram: token_1.TOKEN_PROGRAM_ID,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .instruction();
        const latestBlockHash = yield connection.getLatestBlockhash();
        const tx = new anchor.web3.Transaction({
            recentBlockhash: latestBlockHash.blockhash,
        });
        tx.add(initIx);
        try {
            //  await provider.sendAndConfirm(tx, []);
        }
        catch (e) {
            console.log(e);
        }
        const airdropAmount = new anchor.BN(totalAmount);
        console.log({ airdropAmount });
        const airdropAta = (0, token_1.associatedAddress)({
            mint: tokenMint,
            owner: provider.publicKey,
        });
        try {
            // second txn: mint tokens (for testing) airdrop
            yield (0, utils_1.mintToAccount)(provider, tokenMint, airdropAta, airdropAmount, provider.publicKey, token_1.TOKEN_PROGRAM_ID, (0, spl_token_1.createAssociatedTokenAccountIdempotentInstruction)(provider.publicKey, // payer
            airdropAta, // owner associated token account
            provider.publicKey, // token ata owner
            tokenMint // mint account
            ));
        }
        catch (e) {
            console.log(e);
        }
        const vault = (0, token_1.associatedAddress)({ mint: tokenMint, owner: airdropState });
        const latestBlockHashAta = yield connection.getLatestBlockhash();
        // third txn: create ata (for testing) airdrop
        const txAta = new anchor.web3.Transaction({
            recentBlockhash: latestBlockHashAta.blockhash,
        });
        txAta.add((0, spl_token_1.createAssociatedTokenAccountIdempotentInstruction)(provider.publicKey, // payer
        vault, // owner associated token account
        airdropState, // token ata owner
        tokenMint // mint account
        ));
        try {
            //   await provider.sendAndConfirm(txAta, []);
        }
        catch (e) {
            console.log(e);
        }
        try {
            // fourth txn: transfer tokens from mint authority (for testing) airdrop
            yield (0, spl_token_1.transfer)(connection, wallet.payer, airdropAta, vault, wallet.payer, airdropAmount.toNumber(), []);
        }
        catch (e) {
            console.log(e);
        }
        // index is the index of the account in the file
        const testAccount = claimorTestKeypair.publicKey;
        const index = amountsByRecipient.findIndex((e) => e.account.toString() === testAccount.toString());
        console.log(claimorTestKeypair.publicKey);
        console.log('index of claimor', index);
        //  return
        // merkle proof
        const proofStrings = tree.getProof(index, amountsByRecipient[index].account, amountsByRecipient[index].amount);
        const proofBytes = proofStrings.map((p) => (0, utils_1.toBytes32Array)(p));
        let verificationData = Buffer.allocUnsafe(8);
        verificationData.writeBigUInt64LE(BigInt(index));
        // the receipt must be here since it is only the first 8 bytes rather than the complete data
        const [receipt, _receiptBump] = anchor.web3.PublicKey.findProgramAddressSync([
            Buffer.from("receipt"),
            airdropState.toBuffer(),
            testAccount.toBuffer(),
            verificationData,
        ], merkleAirdropProgram.programId);
        for (const proofElem of proofBytes) {
            verificationData = Buffer.concat([
                verificationData,
                Buffer.from(proofElem),
            ]);
        }
        const computeBudgetIx = web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({
            units: 400000,
        });
        // last transaction: Claim instruction
        const claimIxn = yield merkleAirdropProgram.methods
            .claim((0, utils_1.toBytes32Array)(merkleRoot), amountsByRecipient[index].amount, verificationData)
            .accounts({
            owner: testAccount,
            ownerMintAta: (0, token_1.associatedAddress)({
                mint: tokenMint,
                owner: testAccount,
            }),
            tokenMint,
            treasury: new web3_js_1.PublicKey("HF3CBT9JFfgN3S61JWAduB8mT2SmsgtRihFZvnyvjQQK"),
            receipt,
            airdropState,
            vault,
            splTokenProgram: token_1.TOKEN_PROGRAM_ID,
            ataProgram: spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID,
        })
            .signers([claimorTestKeypair])
            .instruction();
        const latestBlockHashClaim = yield connection.getLatestBlockhash();
        const txClaim = new anchor.web3.Transaction({
            recentBlockhash: latestBlockHashClaim.blockhash,
        });
        txClaim.add(...[computeBudgetIx, claimIxn]);
        yield provider.sendAndConfirm(txClaim, [claimorTestKeypair]);
        console.log(merkleRoot);
        console.log(verificationData);
        /*
        
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
          */
    });
}
main();
