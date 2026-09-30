import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { shardModelFile } from "../scripts/omega-file-sharder.js";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("streaming sharder emits contiguous block hashes inside every chunk", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "omega-sharder-blocks-"));
  const input = path.join(root, "model.bin");
  const output = path.join(root, "parts");
  const source = Buffer.alloc(100, 0x5a);
  await fs.writeFile(input, source);

  try {
    const result = await shardModelFile(input, output, {
      chunkBytes: 60,
      blockBytes: 16,
      cleanOutput: true
    });

    assert.equal(result.manifest.schema_version, "1.1.0");
    assert.match(result.manifest.integrity.rolling_root_sha256, /^[a-f0-9]{64}$/);
    assert.match(result.manifest.integrity.merkle_root_sha256, /^[a-f0-9]{64}$/);
    for (const chunk of result.manifest.chunks) {
      let offset = 0;
      for (const [index, block] of chunk.blocks.entries()) {
        assert.equal(block.index, index);
        assert.equal(block.offset, offset);
        const bytes = await fs.readFile(path.join(output, chunk.name));
        const slice = bytes.subarray(block.offset, block.offset + block.bytes);
        assert.equal(sha256(slice), block.sha256);
        assert.match(block.rolling_sha256, /^[a-f0-9]{64}$/);
        offset += block.bytes;
      }
      assert.equal(offset, chunk.bytes);
      assert.match(chunk.rolling_root_sha256, /^[a-f0-9]{64}$/);
      assert.match(chunk.merkle_root_sha256, /^[a-f0-9]{64}$/);
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
