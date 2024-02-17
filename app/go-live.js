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
        const tokenMint = new web3_js_1.PublicKey("LGNDWdLatceN2Td6yK6kA9A34HF489ZJ3RR6n7QqUxG");
        console.log("tokenMint", tokenMint.toString());
        const amountsByRecipient = [];
        let totalAmount = 0;
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
        //await provider.sendAndConfirm(tx, []);
        console.log("initialized airdrop");
        const vault = (0, token_1.associatedAddress)({ mint: tokenMint, owner: airdropState });
        console.log(vault.toString());
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
        yield provider.sendAndConfirm(txAta, []);
    });
}
main();
