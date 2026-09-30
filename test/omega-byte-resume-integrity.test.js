import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { ByteRangeResumeEngine } from "../src/distribution/omega-byte-resume.js";
import {
  computeChunkIntegrity,
  computeRollingStep,
  ROLLING_SHA256_INITIAL
} from "../src/distribution/omega-integrity-chain.js";

const sha256 = value => createHash("sha256").update(value).digest("hex");

function makeBlocks(payload, blockBytes) {
  const blocks = [];
  for (let offset = 0, index = 0; offset < payload.length; offset += blockBytes, index += 1) {
    const bytes = Math.min(blockBytes, payload.length - offset);
    blocks.push({
      index,
      offset,
      bytes,
      sha256: sha256(payload.subarray(offset, offset + bytes))
    });
  }
  let rolling = ROLLING_SHA256_INITIAL;
  for (const block of blocks) {
    rolling = computeRollingStep(rolling, block);
    block.rolling_sha256 = rolling;
  }
  return blocks;
}

test("resumable download verifies cumulative rolling state and Merkle root", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "omega-resume-integrity-"));
  const payload = Buffer.from("0123456789ABCDEFGHIJ");
  const destinationPath = path.join(root, "chunk.bin");
  const blockHashes = makeBlocks(payload, 5);
  const integrity = computeChunkIntegrity(blockHashes);

  await fs.writeFile(destinationPath, payload.subarray(0, 8));
  await fs.writeFile(destinationPath + ".resume.json", JSON.stringify({
    schema_version: "1.1.0",
    url: "https://example.test/chunk.bin",
    expected_size: payload.length,
    expected_sha256: sha256(payload),
    expected_rolling_root_sha256: integrity.rolling_root_sha256,
    expected_merkle_root_sha256: integrity.merkle_root_sha256,
    validator: { etag: '"v1"', last_modified: null }
  }));

  try {
    const engine = new ByteRangeResumeEngine({
      blockBytes: 5,
      fetchImpl: async (_url, init) => {
        assert.equal(init.headers.Range, "bytes=5-");
        return new Response(payload.subarray(5), {
          status: 206,
          headers: {
            "Content-Range": "bytes 5-" + (payload.length - 1) + "/" + payload.length,
                        ETag: '"v1"'
          }
        });
      }
    });

    const result = await engine.download({
      url: "https://example.test/chunk.bin",
      destinationPath,
      expectedSize: payload.length,
      expectedSha256: sha256(payload),
      blockHashes,
      rollingRootSha256: integrity.rolling_root_sha256,
      merkleRootSha256: integrity.merkle_root_sha256,
      requireCumulativeIntegrity: true
    });

    assert.equal(result.status, "downloaded");
    assert.equal(result.rolling_root_sha256, integrity.rolling_root_sha256);
    assert.equal(result.merkle_root_sha256, integrity.merkle_root_sha256);
    assert.deepEqual(await fs.readFile(destinationPath), payload);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
