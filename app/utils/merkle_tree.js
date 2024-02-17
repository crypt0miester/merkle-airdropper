"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerkleTree = void 0;
const js_sha3_1 = require("js-sha3");
function getPairElement(idx, layer) {
    const pairIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (pairIdx < layer.length) {
        const pairEl = layer[pairIdx];
        return pairEl;
    }
    return null;
}
function bufDedup(elements) {
    return elements.filter((el, idx) => { var _a; return idx === 0 || !((_a = elements[idx - 1]) === null || _a === void 0 ? void 0 : _a.equals(el)); });
}
function bufArrToHexArr(arr) {
    if (arr.some((el) => !Buffer.isBuffer(el))) {
        throw new Error("Array is not an array of buffers");
    }
    return arr.map((el) => `0x${el.toString("hex")}`);
}
function sortAndConcat(...args) {
    return Buffer.concat([...args].sort(Buffer.compare.bind(null)));
}
class MerkleTree {
    constructor(elements) {
        this._elements = [...elements];
        this._elements.sort(Buffer.compare.bind(null));
        this._elements = bufDedup(this._elements);
        this._bufferElementPositionIndex = this._elements.reduce((memo, el, index) => {
            memo[el.toString("hex")] = index;
            return memo;
        }, {});
        this._layers = this.getLayers(this._elements);
    }
    getLayers(elements) {
        var _a, _b;
        if (elements.length === 0) {
            throw new Error("empty tree");
        }
        const layers = [];
        layers.push(elements);
        // Get next layer until we reach the root
        while (((_b = (_a = layers[layers.length - 1]) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) > 1) {
            const nextLayerIndex = layers[layers.length - 1];
            layers.push(this.getNextLayer(nextLayerIndex));
        }
        return layers;
    }
    getNextLayer(elements) {
        return elements.reduce((layer, el, idx, arr) => {
            if (idx % 2 === 0) {
                // Hash the current element with its pair element
                const pairEl = arr[idx + 1];
                layer.push(MerkleTree.combinedHash(el, pairEl));
            }
            return layer;
        }, []);
    }
    static combinedHash(first, second) {
        if (!first) {
            return second;
        }
        if (!second) {
            return first;
        }
        return Buffer.from(js_sha3_1.keccak_256.digest(sortAndConcat(first, second)));
    }
    getRoot() {
        var _a;
        const root = (_a = this._layers[this._layers.length - 1]) === null || _a === void 0 ? void 0 : _a[0];
        return root;
    }
    getHexRoot() {
        return this.getRoot().toString("hex");
    }
    getProof(el) {
        const initialIdx = this._bufferElementPositionIndex[el.toString("hex")];
        if (typeof initialIdx !== "number") {
            throw new Error("Element does not exist in Merkle tree");
        }
        let idx = initialIdx;
        return this._layers.reduce((proof, layer) => {
            const pairElement = getPairElement(idx, layer);
            if (pairElement) {
                proof.push(pairElement);
            }
            idx = Math.floor(idx / 2);
            return proof;
        }, []);
    }
    getHexProof(el) {
        const proof = this.getProof(el);
        return bufArrToHexArr(proof);
    }
}
exports.MerkleTree = MerkleTree;
