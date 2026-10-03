import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { reconstructReleaseParts, validateReleasePartsManifest, verifyReleaseParts } from '../src/local-model-release-parts.js';

test('validates and reconstructs split release assets', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'deen-model-parts-'));
  try {
    const chunks = [Buffer.from('abc'), Buffer.from('defgh')];
    const parts = chunks.map((data, index) => {
      const name = 'part-' + index;
      fs.writeFileSync(path.join(directory, name), data);
      return { name, bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') };
    });
    const manifest = { model: 'Qwen/Qwen3-1.7B', archive: 'qwen3-1.7b.tar.zst', archiveBytes: 8, parts };
    assert.equal(validateReleasePartsManifest(manifest), true);
    assert.equal(verifyReleaseParts(directory, manifest).ok, true);
    const output = path.join(directory, manifest.archive);
    const result = reconstructReleaseParts(directory, manifest, output);
    assert.equal(result.ok, true);
    assert.equal(fs.readFileSync(output, 'utf8'), 'abcdefgh');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('fails closed when a release part is modified', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'deen-model-parts-'));
  try {
    const data = Buffer.from('abc');
    const name = 'part-0';
    fs.writeFileSync(path.join(directory, name), data);
    const manifest = { model: 'Qwen/Qwen3-1.7B', archive: 'qwen3-1.7b.tar.zst', archiveBytes: 3, parts: [{ name, bytes: 3, sha256: '0'.repeat(64) }] };
    const result = verifyReleaseParts(directory, manifest);
    assert.equal(result.ok, false);
    assert.equal(result.failures[0].reason, 'checksum-or-size-mismatch');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});