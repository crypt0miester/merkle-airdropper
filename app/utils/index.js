"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toBeBytes = exports.toBytes32Array = exports.createTokenAccount = exports.mintToAccount = exports.createMint = void 0;
const spl_token_1 = require("@coral-xyz/spl-token");
const spl_token_2 = require("@solana/spl-token");
const web3_js_1 = require("@solana/web3.js");
const anchor = require("@coral-xyz/anchor");
const DEFAULT_MINT_DECIMALS = 6;
function createMintInstructions(provider, authority, mint, tokenProgram) {
    return __awaiter(this, void 0, void 0, function* () {
        const program = (0, spl_token_1.splTokenProgram)({
            provider,
            programId: tokenProgram,
        });
        const initMintIx = yield program.methods
            .initializeMint(DEFAULT_MINT_DECIMALS, authority, authority)
            .accounts({
            mint: mint,
            rent: web3_js_1.SYSVAR_RENT_PUBKEY,
        })
            .instruction();
        const instructions = [
            anchor.web3.SystemProgram.createAccount({
                fromPubkey: provider.publicKey,
                newAccountPubkey: mint,
                space: 82,
                lamports: yield provider.connection.getMinimumBalanceForRentExemption(82),
                programId: tokenProgram,
            }),
            initMintIx,
        ];
        return instructions;
    });
}
function createMint(provider, initialAuthority, tokenProgram) {
    return __awaiter(this, void 0, void 0, function* () {
        let authority = initialAuthority;
        if (authority === undefined) {
            authority = provider.publicKey;
        }
        const mint = anchor.web3.Keypair.generate();
        const instructions = yield createMintInstructions(provider, authority, mint.publicKey, tokenProgram);
        const tx = new anchor.web3.Transaction();
        tx.add(...instructions);
        yield provider.sendAndConfirm(tx, [mint]);
        return mint.publicKey;
    });
}
exports.createMint = createMint;
function mintToAccount(provider, mint, destination, amount, mintAuthority, tokenProgram, instruction) {
    return __awaiter(this, void 0, void 0, function* () {
        const tx = new anchor.web3.Transaction();
        tx.add(instruction, (0, spl_token_2.createMintToInstruction)(mint, // mint account
        destination, // destination associated token account
        mintAuthority, // authority
        amount.toNumber(), //number of tokens
        [], tokenProgram));
        yield provider.sendAndConfirm(tx, [], { skipPreflight: true });
    });
}
exports.mintToAccount = mintToAccount;
function createTokenAccountInstrs(provider, newAccountPubkey, mint, owner, tokenProgram, lamportsRequested) {
    return __awaiter(this, void 0, void 0, function* () {
        let lamports = lamportsRequested;
        if (lamports === undefined) {
            lamports = yield provider.connection.getMinimumBalanceForRentExemption(165);
        }
        const program = (0, spl_token_1.splTokenProgram)({
            provider,
            programId: tokenProgram,
        });
        const initializeAccountIx = yield program.methods
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
    });
}
function createTokenAccount(provider, mint, tokenProgram, owner) {
    return __awaiter(this, void 0, void 0, function* () {
        const vault = anchor.web3.Keypair.generate();
        const tx = new anchor.web3.Transaction();
        tx.add(...(yield createTokenAccountInstrs(provider, vault.publicKey, mint, owner, tokenProgram, undefined)));
        yield provider.sendAndConfirm(tx, [vault]);
        return vault.publicKey;
    });
}
exports.createTokenAccount = createTokenAccount;
const toBytes32Array = (b) => {
    const buf = Buffer.alloc(32);
    b.copy(buf, 32 - b.length);
    return Array.from(buf);
};
exports.toBytes32Array = toBytes32Array;
function toBeBytes(x) {
    const y = Math.floor(x / Math.pow(2, 32));
    return Uint8Array.from([y, y << 8, y << 16, y << 24, x, x << 8, x << 16, x << 24].map((z) => z >>> 24));
}
exports.toBeBytes = toBeBytes;
