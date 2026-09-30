import { createHash } from "node:crypto";

const HEX_SHA256 = /^[a-f0-9]{64}$/i;
const ROLLING_DOMAIN = Buffer.from("dinullah/omega/rolling-sha256/v1\0", "utf8");
const MERKLE_LEAF_DOMAIN = Buffer.from("dinullah/omega/merkle-leaf/v1\0", "utf8");
const MERKLE_NODE_DOMAIN = Buffer.from("dinullah/omega/merkle-node/v1\0", "utf8");

function assertHash(value, name) {
  if (!HEX_SHA256.test(String(value ?? ""))) throw new TypeError(name + " must be a SHA-256 hex digest");
  return String(value).toLowerCase();
}

function hashParts(parts) {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part);
  return hash.digest("hex");
}

function uint64be(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(name + " must be a non-negative safe integer");
  const buffer = Buffer.allocUnsafe(8);
  buffer.writeBigUInt64BE(BigInt(value));
  return buffer;
}

function hashBytes(hex) {
  return Buffer.from(assertHash(hex, "sha256"), "hex");
}

export const ROLLING_SHA256_INITIAL = hashParts([
  ROLLING_DOMAIN,
  Buffer.from("initial\0", "utf8")
]);

export function computeRollingStep(previousSha256, block) {
  const previous = previousSha256 == null
    ? ROLLING_SHA256_INITIAL
    : assertHash(previousSha256, "previousSha256");

  assertHash(block?.sha256, "block.sha256");
  return hashParts([
    ROLLING_DOMAIN,
    hashBytes(previous),
    uint64be(block.index, "block.index"),
    uint64be(block.offset, "block.offset"),
    uint64be(block.bytes, "block.bytes"),
    hashBytes(block.sha256)
  ]);
}

export function computeRollingSha256(blocks = []) {
  let state = ROLLING_SHA256_INITIAL;
  for (const block of blocks) state = computeRollingStep(state, block);
  return state;
}

export function computeMerkleLeafSha256(block) {
  assertHash(block?.sha256, "block.sha256");
  return hashParts([
    MERKLE_LEAF_DOMAIN,
    uint64be(block.index, "block.index"),
    uint64be(block.offset, "block.offset"),
    uint64be(block.bytes, "block.bytes"),
    hashBytes(block.sha256)
  ]);
}

export function computeMerkleParentSha256(left, right) {
  return hashParts([
    MERKLE_NODE_DOMAIN,
    hashBytes(assertHash(left, "left")),
    hashBytes(assertHash(right, "right"))
  ]);
}

export function computeMerkleRootFromLeafHashes(leafHashes) {
  if (!Array.isArray(leafHashes) || leafHashes.length === 0) {
    throw new RangeError("Merkle tree requires at least one leaf");
  }

  let level = leafHashes.map((hash, index) => assertHash(hash, "leafHashes[" + index + "]"));
  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? left;
      next.push(computeMerkleParentSha256(left, right));
    }
    level = next;
  }
  return level[0];
}

export function computeMerkleRoot(blocks = []) {
  return computeMerkleRootFromLeafHashes(blocks.map(computeMerkleLeafSha256));
}

export function computeChunkDistributionLeafSha256(chunk) {
  return hashParts([
    MERKLE_LEAF_DOMAIN,
    uint64be(chunk.index, "chunk.index"),
    uint64be(chunk.bytes, "chunk.bytes"),
    hashBytes(assertHash(chunk.sha256, "chunk.sha256")),
    hashBytes(assertHash(chunk.merkle_root_sha256, "chunk.merkle_root_sha256")),
    hashBytes(assertHash(chunk.rolling_root_sha256, "chunk.rolling_root_sha256"))
  ]);
}

export function computeDistributionMerkleRoot(chunks = []) {
  return computeMerkleRootFromLeafHashes(chunks.map(computeChunkDistributionLeafSha256));
}

export function computeDistributionRollingRoot(chunks = []) {
  let state = ROLLING_SHA256_INITIAL;
  let offset = 0;
  for (const chunk of chunks) {
    state = computeRollingStep(state, {
      index: chunk.index,
      offset,
      bytes: chunk.bytes,
      sha256: chunk.sha256
    });
    offset += chunk.bytes;
  }
  return state;
}

export function computeChunkIntegrity(blocks = []) {
  return Object.freeze({
    rolling_root_sha256: computeRollingSha256(blocks),
    merkle_root_sha256: computeMerkleRoot(blocks)
  });
}

export function computeDistributionIntegrity(chunks = []) {
  return Object.freeze({
    algorithm: "sha256",
    rolling_algorithm: "sha256-chain-v1",
    merkle_algorithm: "sha256-merkle-v1-duplicate-last",
    rolling_root_sha256: computeDistributionRollingRoot(chunks),
    merkle_root_sha256: computeDistributionMerkleRoot(chunks)
  });
}
