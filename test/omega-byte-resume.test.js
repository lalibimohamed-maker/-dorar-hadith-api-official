import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { ByteRangeResumeEngine } from "../src/distribution/omega-byte-resume.js";

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function blocks(buffer, blockBytes) {
  const result = [];
  for (let offset = 0, index = 0; offset < buffer.length; offset += blockBytes, index += 1) {
    const bytes = Math.min(blockBytes, buffer.length - offset);
    result.push({
      index,
      offset,
      bytes,
      sha256: sha256(buffer.subarray(offset, offset + bytes))
    });
  }
  return result;
}

function response(body, status, headers) {
  return new Response(body, { status, headers });
}

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "omega-resume-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("resumes only from verified blocks and validates Content-Range", async () => {
  await withTempDir(async dir => {
    const payload = Buffer.from("0123456789ABCDEFGHIJ");
    const blockHashes = blocks(payload, 5);
    const destinationPath = path.join(dir, "chunk.bin");

    await fs.writeFile(destinationPath, payload.subarray(0, 8));
    await fs.writeFile(destinationPath + ".resume.json", JSON.stringify({
      url: "https://example.test/chunk.bin",
      expected_size: payload.length,
      validator: { etag: "\"v1\"", last_modified: null }
    }));

    const engine = new ByteRangeResumeEngine({
      blockBytes: 5,
      fetchImpl: async (_url, init) => {
        assert.equal(init.headers.Range, "bytes=5-");
        assert.equal(init.headers["If-Range"], "\"v1\"");
        return response(payload.subarray(5), 206, {
          "Content-Range": "bytes 5-" + (payload.length - 1) + "/" + payload.length,
          ETag: "\"v1\""
        });
      }
    });

    const result = await engine.download({
      url: "https://example.test/chunk.bin",
      destinationPath,
      expectedSize: payload.length,
      expectedSha256: sha256(payload),
      blockHashes
    });

    assert.equal(result.status, "downloaded");
    assert.deepEqual(await fs.readFile(destinationPath), payload);
  });
});

test("never appends a full 200 response to an existing partial file", async () => {
  await withTempDir(async dir => {
    const payload = Buffer.from("abcdefghij");
    const destinationPath = path.join(dir, "chunk.bin");

    await fs.writeFile(destinationPath, payload.subarray(0, 5));
    await fs.writeFile(destinationPath + ".resume.json", JSON.stringify({
      url: "https://example.test/chunk.bin",
      expected_size: payload.length,
      validator: { etag: "\"v1\"", last_modified: null }
    }));

    const engine = new ByteRangeResumeEngine({
      blockBytes: 5,
      fetchImpl: async () => response(payload, 200, { ETag: "\"v1\"" })
    });

    const result = await engine.download({
      url: "https://example.test/chunk.bin",
      destinationPath,
      expectedSize: payload.length,
      expectedSha256: sha256(payload),
      blockHashes: blocks(payload, 5)
    });

    assert.equal(result.status, "downloaded");
    assert.deepEqual(await fs.readFile(destinationPath), payload);
  });
});

test("rejects mismatched Content-Range rather than writing", async () => {
  await withTempDir(async dir => {
    const payload = Buffer.from("abcdefghij");
    const destinationPath = path.join(dir, "chunk.bin");

    await fs.writeFile(destinationPath, payload.subarray(0, 5));
    await fs.writeFile(destinationPath + ".resume.json", JSON.stringify({
      url: "https://example.test/chunk.bin",
      expected_size: payload.length,
      validator: { etag: "\"v1\"", last_modified: null }
    }));

    const engine = new ByteRangeResumeEngine({
      blockBytes: 5,
      fetchImpl: async () => response(payload.subarray(5), 206, {
        "Content-Range": "bytes 4-" + (payload.length - 1) + "/" + payload.length,
        ETag: "\"v1\""
      })
    });

    await assert.rejects(() => engine.download({
      url: "https://example.test/chunk.bin",
      destinationPath,
      expectedSize: payload.length,
      expectedSha256: sha256(payload),
      blockHashes: blocks(payload, 5)
    }), /RANGE_RESPONSE_INVALID/);

    assert.deepEqual(await fs.readFile(destinationPath), payload.subarray(0, 5));
  });
});
