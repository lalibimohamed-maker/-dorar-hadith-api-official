import fs from 'node:fs';
import crypto from 'node:crypto';

export function validateReleasePartsManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new TypeError('manifest must be an object');
  if (!manifest.model || !manifest.archive || !Array.isArray(manifest.parts) || manifest.parts.length === 0) {
    throw new TypeError('release parts manifest is incomplete');
  }
  for (const part of manifest.parts) {
    if (!part?.name || !Number.isSafeInteger(part.bytes) || !/^[a-zA-Z0-9._-]+$/.test(part.name)) {
      throw new TypeError('release part entry is invalid');
    }
    if (!/^[a-f0-9]{64}$/.test(part.sha256)) {
      throw new TypeError('release part checksum is invalid');
    }
  }
  return true;
}

export function verifyReleaseParts(directory, manifest) {
  validateReleasePartsManifest(manifest);
  const failures = [];
  let totalBytes = 0;
  for (const part of manifest.parts) {
    const path = directory + '/' + part.name;
    if (!fs.existsSync(path)) {
      failures.push({ name: part.name, reason: 'missing' });
      continue;
    }
    const bytes = fs.statSync(path).size;
    totalBytes += bytes;
    const digest = crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
    if (bytes !== part.bytes || digest !== part.sha256) {
      failures.push({ name: part.name, reason: 'checksum-or-size-mismatch', bytes, digest });
    }
  }
  return Object.freeze({ ok: failures.length === 0, totalBytes, failures });
}

export function reconstructReleaseParts(directory, manifest, outputPath) {
  const verification = verifyReleaseParts(directory, manifest);
  if (!verification.ok) throw new Error('release parts verification failed');
  const fd = fs.openSync(outputPath, 'w');
  try {
    for (const part of manifest.parts) {
      fs.writeSync(fd, fs.readFileSync(directory + '/' + part.name));
    }
  } finally {
    fs.closeSync(fd);
  }
  const bytes = fs.statSync(outputPath).size;
  return Object.freeze({ outputPath, bytes, expectedBytes: manifest.archiveBytes, ok: bytes === manifest.archiveBytes });
}