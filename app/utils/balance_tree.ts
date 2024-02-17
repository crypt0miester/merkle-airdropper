import * as anchor from "@coral-xyz/anchor";
import type { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";
import { keccak_256 } from "js-sha3";

import { MerkleTree } from "./merkle_tree";

export class BalanceTree {
  private readonly _tree: MerkleTree;

  constructor(balances: { account: PublicKey; amount: BN }[]) {
    this._tree = new MerkleTree(
      balances.map(({ account, amount }, index) =>
        BalanceTree.toNode(index, account, amount)
      )
    );
  }

  static verifyProof(
    index: number,
    account: PublicKey,
    amount: BN,
    proof: Buffer[],
    root: Buffer
  ): boolean {
    let pair = BalanceTree.toNode(index, account, amount);
    for (const item of proof) {
      pair = MerkleTree.combinedHash(pair, item);
    }

    return pair.equals(root);
  }

  static toNode(index: number, account: PublicKey, amount: BN): Buffer {
    const buf = Buffer.concat([
      new anchor.BN(index).toArrayLike(Buffer, "le", 8),
      account.toBuffer(),
      new anchor.BN(amount).toArrayLike(Buffer, "le", 8),
    ]);
    return Buffer.from(keccak_256(buf), "hex");
  }

  getHexRoot(): string {
    return this._tree.getHexRoot();
  }

  getHexProof(index: number, account: PublicKey, amount: BN): string[] {
    return this._tree.getHexProof(BalanceTree.toNode(index, account, amount));
  }

  getRoot(): Buffer {
    return this._tree.getRoot();
  }

  getProof(index: number, account: PublicKey, amount: BN): Buffer[] {
    return this._tree.getProof(BalanceTree.toNode(index, account, amount));
  }
}
