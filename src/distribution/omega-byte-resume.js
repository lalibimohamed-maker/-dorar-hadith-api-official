import fs from "node:fs";
import { mkdir, open, readFile, rm, stat, truncate, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const HEX_SHA256 = /^[a-f0-9]{64}$/i;
const DEFAULT_BLOCK_BYTES = 16 * 1024 * 1024;

function positiveSafeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(name + " must be a positive safe integer");
  return value;
}

function parseContentRange(value) {
  const match = /^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i.exec(String(value ?? "").trim());
  if (!match) return null;
  return {
    start: Number(match[1]),
    end: Number(match[2]),
    total: match[3] === "*" ? null : Number(match[3])
  };
}

function responseValidator(headers) {
  return Object.freeze({
    etag: headers.get("etag") || null,
    last_modified: headers.get("last-modified") || null
  });
}

async function readResumeState(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function writeResumeState(filePath, state) {
  await writeFile(filePath, JSON.stringify(state, null, 2) + "\n", "utf8");
}

async function hashRange(filePath, start, bytes) {
  const handle = await open(filePath, "r");
  try {
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(Math.min(1024 * 1024, bytes));
    let offset = start;
    let remaining = bytes;
    while (remaining > 0) {
      const want = Math.min(buffer.length, remaining);
      const { bytesRead } = await handle.read(buffer, 0, want, offset);
      if (bytesRead !== want) throw new Error("RESUME_VERIFY_EOF");
      hash.update(buffer.subarray(0, bytesRead));
      offset += bytesRead;
      remaining -= bytesRead;
    }
    return hash.digest("hex");
  } finally {
    await handle.close();
  }
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  const input = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
  let bytes = 0;
  for await (const chunk of input) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  return { bytes, sha256: hash.digest("hex") };
}

function normalizeBlocks(blockHashes, expectedSize) {
  if (!Array.isArray(blockHashes) || blockHashes.length === 0) return [];
  let expectedOffset = 0;
  return blockHashes.map((block, index) => {
    if (block?.index !== index) throw new Error("BLOCK_INDEX_MISMATCH:" + index);
    if (!Number.isSafeInteger(block.offset) || block.offset < 0) throw new Error("BLOCK_OFFSET_INVALID:" + index);
    if (!Number.isSafeInteger(block.bytes) || block.bytes < 1) throw new Error("BLOCK_BYTES_INVALID:" + index);
    if (block.offset !== expectedOffset) throw new Error("BLOCK_OFFSET_NONCONTIGUOUS:" + index);
    if (!HEX_SHA256.test(String(block.sha256 ?? ""))) throw new Error("BLOCK_SHA256_INVALID:" + index);
    expectedOffset += block.bytes;
    if (expectedOffset > expectedSize) throw new Error("BLOCK_COVERAGE_EXCEEDS_SIZE:" + index);
    return {
      index,
      offset: block.offset,
      bytes: block.bytes,
      sha256: String(block.sha256).toLowerCase()
    };
  });
}

async function trustedResumeOffset(destinationPath, expectedSize, blocks) {
  let info;
  try {
    info = await stat(destinationPath);
  } catch (error) {
    if (error?.code === "ENOENT") return 0;
    throw error;
  }
  if (!info.isFile() || info.size <= 0 || info.size >= expectedSize || blocks.length === 0) return 0;

  let trusted = 0;
  for (const block of blocks) {
    if (block.offset + block.bytes > info.size) break;
    const actual = await hashRange(destinationPath, block.offset, block.bytes);
    if (actual !== block.sha256) break;
    trusted = block.offset + block.bytes;
  }
  await truncate(destinationPath, trusted);
  return trusted;
}

async function streamResponseToFile(response, handle, offset, expectedSize) {
  if (!response.body || typeof response.body.getReader !== "function") {
    throw new Error("DOWNLOAD_BODY_UNAVAILABLE");
  }
  const reader = response.body.getReader();
  let position = offset;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new Error("DOWNLOAD_BODY_INVALID");
      if (position + value.byteLength > expectedSize) throw new Error("DOWNLOAD_SIZE_EXCEEDED");
      await handle.write(Buffer.from(value), 0, value.byteLength, position);
      position += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  return position;
}

export class ByteRangeResumeEngine {
  constructor({
    fetchImpl = globalThis.fetch,
    blockBytes = DEFAULT_BLOCK_BYTES,
    requireValidatorForResume = true
  } = {}) {
    if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function");
    this.fetchImpl = fetchImpl;
    this.blockBytes = positiveSafeInteger(blockBytes, "blockBytes");
    this.requireValidatorForResume = Boolean(requireValidatorForResume);
  }

  async download({
    url,
    destinationPath,
    expectedSize,
    expectedSha256,
    blockHashes = [],
    headers = {}
  }) {
    positiveSafeInteger(expectedSize, "expectedSize");
    if (!HEX_SHA256.test(String(expectedSha256 ?? ""))) throw new TypeError("expectedSha256 must be a SHA-256 digest");
    if (typeof url !== "string" || !url) throw new TypeError("url is required");
    if (typeof destinationPath !== "string" || !destinationPath) throw new TypeError("destinationPath is required");

    const absolutePath = path.resolve(destinationPath);
    const statePath = absolutePath + ".resume.json";
    const blocks = normalizeBlocks(blockHashes, expectedSize);
    await mkdir(path.dirname(absolutePath), { recursive: true });

    const existing = await sha256File(absolutePath).catch(error => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    if (existing?.bytes === expectedSize && existing.sha256.toLowerCase() === String(expectedSha256).toLowerCase()) {
      await rm(statePath, { force: true });
      return Object.freeze({ status: "already_verified", bytes: expectedSize, sha256: existing.sha256 });
    }

    let state = await readResumeState(statePath);
    let resumeOffset = await trustedResumeOffset(absolutePath, expectedSize, blocks);

    if (resumeOffset > 0 && (
      !state ||
      state.url !== url ||
      state.expected_size !== expectedSize ||
      (this.requireValidatorForResume && !state.validator?.etag && !state.validator?.last_modified)
    )) {
      resumeOffset = 0;
      await truncate(absolutePath, 0).catch(error => {
        if (error?.code !== "ENOENT") throw error;
      });
    }

    let requestHeaders = { ...headers };
    if (resumeOffset > 0) {
      requestHeaders = { ...requestHeaders, Range: "bytes=" + resumeOffset + "-" };
      const validator = state?.validator?.etag || state?.validator?.last_modified || null;
      if (validator) requestHeaders["If-Range"] = validator;
    }

    let response;
    try {
      response = await this.fetchImpl(url, { headers: requestHeaders });
    } catch (error) {
      const info = await stat(absolutePath).catch(() => ({ size: 0 }));
      await writeResumeState(statePath, {
        schema_version: "1.0.0",
        url,
        expected_size: expectedSize,
        expected_sha256: String(expectedSha256).toLowerCase(),
        bytes_written: info.size,
        validator: state?.validator ?? { etag: null, last_modified: null }
      });
      throw error;
    }

    const validator = responseValidator(response.headers);

    if (resumeOffset > 0 && response.status === 206) {
      const range = parseContentRange(response.headers.get("content-range"));
      if (!range || range.start !== resumeOffset || range.total !== expectedSize || range.end < range.start) {
        throw new Error("RANGE_RESPONSE_INVALID");
      }
      if (state?.validator && (state.validator.etag || state.validator.last_modified) &&
          (state.validator.etag !== validator.etag || state.validator.last_modified !== validator.last_modified)) {
        await truncate(absolutePath, 0);
        return this.download({ url, destinationPath, expectedSize, expectedSha256, blockHashes, headers });
      }
    } else if (resumeOffset > 0 && response.status === 200) {
      // A server that ignores Range returned the complete object: replace the partial file, never append.
      resumeOffset = 0;
      await truncate(absolutePath, 0);
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error("DOWNLOAD_HTTP_ERROR:" + response.status);
    }
    if (resumeOffset > 0 && response.status !== 206) {
      throw new Error("RANGE_RESPONSE_INVALID");
    }

    if (resumeOffset === 0) {
      await truncate(absolutePath, 0).catch(error => {
        if (error?.code !== "ENOENT") throw error;
      });
    }

    const handle = await open(absolutePath, "r+").catch(async error => {
      if (error?.code !== "ENOENT") throw error;
      return open(absolutePath, "w+");
    });

    let finalPosition = resumeOffset;
    try {
      finalPosition = await streamResponseToFile(response, handle, resumeOffset, expectedSize);
    } catch (error) {
      await writeResumeState(statePath, {
        schema_version: "1.0.0",
        url,
        expected_size: expectedSize,
        expected_sha256: String(expectedSha256).toLowerCase(),
        bytes_written: finalPosition,
        validator
      });
      throw error;
    } finally {
      await handle.close();
    }

    if (finalPosition !== expectedSize) {
      await writeResumeState(statePath, {
        schema_version: "1.0.0",
        url,
        expected_size: expectedSize,
        expected_sha256: String(expectedSha256).toLowerCase(),
        bytes_written: finalPosition,
        validator
      });
      throw new Error("DOWNLOAD_INCOMPLETE:" + finalPosition);
    }

    const actual = await sha256File(absolutePath);
    if (actual.bytes !== expectedSize || actual.sha256.toLowerCase() !== String(expectedSha256).toLowerCase()) {
      await writeResumeState(statePath, {
        schema_version: "1.0.0",
        url,
        expected_size: expectedSize,
        expected_sha256: String(expectedSha256).toLowerCase(),
        bytes_written: actual.bytes,
        validator
      });
      throw new Error("DOWNLOAD_FINAL_HASH_MISMATCH");
    }

    for (const block of blocks) {
      const actualBlockHash = await hashRange(absolutePath, block.offset, block.bytes);
      if (actualBlockHash !== block.sha256) {
        throw new Error("DOWNLOAD_BLOCK_HASH_MISMATCH:" + block.index);
      }
    }

    await rm(statePath, { force: true });
    return Object.freeze({
      status: "downloaded",
      bytes: actual.bytes,
      sha256: actual.sha256,
      validator
    });
  }
}

export const DEFAULT_RESUME_BLOCK_BYTES = DEFAULT_BLOCK_BYTES;
