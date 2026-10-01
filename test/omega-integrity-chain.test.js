import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  computeChunkIntegrity,
  computeDistributionIntegrity,
  computeMerkleRoot,
  computeRollingSha256
} from "../src/distribution/omega-integrity-chain.js";

const hash = value => createHash("sha256").update(value).digest("hex");

function makeBlocks(payload, size) {
  const blocks = [];
  for (let offset = 0, index = 0; offset < payload.length; offset += size, index += 1) {
    const bytes = Math.min(size, payload.length - offset);
    blocks.push({
      index,
      offset,
      bytes,
      sha256: hash(payload.subarray(offset, offset + bytes))
    });
  }
  return blocks;
}

test("rolling SHA-256 is cumulative and reproducible", () => {
  const payload = Buffer.from("abcdef0123456789");
  const blocks = makeBlocks(payload, 5);
  const first = computeRollingSha256(blocks);
  const second = computeRollingSha256(blocks);
  assert.equal(first, second);
  const changed = [...blocks];
  changed[1] = { ...changed[1], sha256: hash(Buffer.from("MUTATED")) };
  assert.notEqual(computeRollingSha256(changed), first);
});

test("Merkle root changes when a block descriptor changes", () => {
  const payload = Buffer.from("0123456789ABCDE");
  const blocks = makeBlocks(payload, 4);
  const root = computeMerkleRoot(blocks);
  const changed = [...blocks];
  changed[2] = { ...changed[2], bytes: changed[2].bytes + 1 };
  assert.notEqual(computeMerkleRoot(changed), root);
});

test("distribution root binds chunk hash plus per-chunk rolling/Merkle roots", () => {
  const payload = Buffer.from("abcdefghijklmnopqrstuvwxyz");
  const blocks = makeBlocks(payload, 6);
  const chunkIntegrity = computeChunkIntegrity(blocks);
  const chunks = [{
    index: 0,
    bytes: payload.length,
    sha256: hash(payload),
    ...chunkIntegrity
  }];
  const integrity = computeDistributionIntegrity(chunks);
  assert.equal(integrity.rolling_algorithm, "sha256-chain-v1");
  assert.equal(integrity.merkle_algorithm, "sha256-merkle-v1-duplicate-last");

  const tampered = [{ ...chunks[0], rolling_root_sha256: "f".repeat(64) }];
  assert.notEqual(computeDistributionIntegrity(tampered).merkle_root_sha256, integrity.merkle_root_sha256);
});
