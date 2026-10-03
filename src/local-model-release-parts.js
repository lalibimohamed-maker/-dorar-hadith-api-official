import fs from 'node:fs';
import crypto from 'node:crypto';

const CHUNK_SIZE = 1024 * 1024;

function sha256FileSync(filePath) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(CHUNK_SIZE);
  try {
    while (true) {
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

export function validateReleasePartsManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new TypeError('manifest must be an object');
  if (!manifest.model || !manifest.archive || !Array.isArray(manifest.parts) || manifest.parts.length === 0) {
    throw new TypeError('release parts manifest is incomplete');
  }
  if (manifest.archiveSha256 !== undefined && !/^[a-f0-9]{64}$/.test(manifest.archiveSha256)) {
    throw new TypeError('release archive checksum is invalid');
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
    const digest = sha256FileSync(path);
    if (bytes !== part.bytes || digest !== part.sha256) {
      failures.push({ name: part.name, reason: 'checksum-or-size-mismatch', bytes, digest });
    }
  }
  return Object.freeze({ ok: failures.length === 0, totalBytes, failures });
}

export function reconstructReleaseParts(directory, manifest, outputPath) {
  const verification = verifyReleaseParts(directory, manifest);
  if (!verification.ok) throw new Error('release parts verification failed');

  const outputFd = fs.openSync(outputPath, 'w');
  const archiveHash = crypto.createHash('sha256');

  try {
    for (const part of manifest.parts) {
      const inputFd = fs.openSync(directory + '/' + part.name, 'r');
      const buffer = Buffer.allocUnsafe(CHUNK_SIZE);
      try {
        while (true) {
          const bytesRead = fs.readSync(inputFd, buffer, 0, buffer.length, null);
          if (bytesRead === 0) break;
          const chunk = buffer.subarray(0, bytesRead);
          fs.writeSync(outputFd, chunk);
          archiveHash.update(chunk);
        }
      } finally {
        fs.closeSync(inputFd);
      }
    }
  } finally {
    fs.closeSync(outputFd);
  }

  const bytes = fs.statSync(outputPath).size;
  const archiveSha256 = archiveHash.digest('hex');
  const ok = bytes === manifest.archiveBytes &&
    (manifest.archiveSha256 === undefined || archiveSha256 === manifest.archiveSha256);

  return Object.freeze({
    outputPath,
    bytes,
    expectedBytes: manifest.archiveBytes,
    archiveSha256,
    expectedArchiveSha256: manifest.archiveSha256 ?? null,
    ok
  });
}
