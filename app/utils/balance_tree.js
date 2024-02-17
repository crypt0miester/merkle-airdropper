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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BalanceTree = void 0;
const anchor = __importStar(require("@coral-xyz/anchor"));
const js_sha3_1 = require("js-sha3");
const merkle_tree_1 = require("./merkle_tree");
class BalanceTree {
    constructor(balances) {
        this._tree = new merkle_tree_1.MerkleTree(balances.map(({ account, amount }, index) => BalanceTree.toNode(index, account, amount)));
    }
    static verifyProof(index, account, amount, proof, root) {
        let pair = BalanceTree.toNode(index, account, amount);
        for (const item of proof) {
            pair = merkle_tree_1.MerkleTree.combinedHash(pair, item);
        }
        return pair.equals(root);
    }
    static toNode(index, account, amount) {
        const buf = Buffer.concat([
            new anchor.BN(index).toArrayLike(Buffer, "le", 8),
            account.toBuffer(),
            new anchor.BN(amount).toArrayLike(Buffer, "le", 8),
        ]);
        return Buffer.from((0, js_sha3_1.keccak_256)(buf), "hex");
    }
    getHexRoot() {
        return this._tree.getHexRoot();
    }
    getHexProof(index, account, amount) {
        return this._tree.getHexProof(BalanceTree.toNode(index, account, amount));
    }
    getRoot() {
        return this._tree.getRoot();
    }
    getProof(index, account, amount) {
        return this._tree.getProof(BalanceTree.toNode(index, account, amount));
    }
}
exports.BalanceTree = BalanceTree;
