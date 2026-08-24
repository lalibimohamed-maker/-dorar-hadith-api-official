import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const manifestPath = process.env.CONTENT_MANIFEST || "artifacts/quarantine/manifest.json";
if (!fs.existsSync(manifestPath)) {
  console.log("Content ingest gate: no quarantine manifest present; nothing to publish.");
  process.exit(0);
}

const MAX_MANIFEST = 1024 * 1024;
const MAX_ITEM = 50 * 1024 * 1024;
const raw = fs.readFileSync(manifestPath);
if (raw.length > MAX_MANIFEST) throw new Error("quarantine manifest exceeds maximum size");
const manifest = JSON.parse(raw);
if (!Array.isArray(manifest.items)) throw new Error("invalid quarantine manifest: items[] required");

const bad = [];
for (const [i, item] of manifest.items.entries()) {
  const label = item.sourceId || String(i);
  if (!item.sourceId || !item.sourceUrl || !item.retrievedAt || !item.sha256 || !Number.isInteger(item.bytes) || !item.status) {
    bad.push(label + ": incomplete provenance metadata");
    continue;
  }
  if (!/^https:\/\//i.test(item.sourceUrl)) bad.push(label + ": sourceUrl must use HTTPS");
  if (!/^[a-f0-9]{64}$/i.test(item.sha256)) bad.push(label + ": invalid SHA-256");
  if (item.bytes < 0 || item.bytes > MAX_ITEM) bad.push(label + ": item exceeds maximum size");
  if (!["quarantined","verified"].includes(item.status)) bad.push(label + ": invalid status");
  const p = String(item.path || "");
  if (path.posix.isAbsolute(p) || p.includes("..") || p.includes("\\") || p.startsWith("/")) {
    bad.push(label + ": unsafe relative path");
  }
  if (item.status === "verified" && item.sha256 !== item.expectedSha256) {
    bad.push(label + ": verified item hash does not match expectedSha256");
  }
}

const digest = crypto.createHash("sha256").update(raw).digest("hex");
fs.mkdirSync(path.dirname(manifestPath), {recursive:true});
fs.writeFileSync(manifestPath + ".sha256", digest + "  " + path.basename(manifestPath) + "\n");

if (bad.length) {
  console.error("Content ingest gate blocked publication:");
  console.error(bad.join("\n"));
  process.exit(1);
}
console.log("Content ingest gate passed: provenance, HTTPS, size, status, hash and path checks are valid.");
