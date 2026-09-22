#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const CONFIG = path.join(ROOT, "config/quran-institutional-acquisition-2026-09-22.json");
const OUT = path.join(ROOT, "artifacts/quran-institutional-acquisition");
const MAX_BYTES = 300 * 1024 * 1024;

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}
function md5(data) {
  return crypto.createHash("md5").update(data).digest("hex");
}
function validPdf(data) {
  return data.subarray(0, 5).toString("ascii") === "%PDF-";
}
function validRar(data) {
  return data.length >= 7 &&
    data[0] === 0x52 && data[1] === 0x61 && data[2] === 0x72 &&
    data[3] === 0x21 && data[4] === 0x1a && data[5] === 0x07;
}

const config = JSON.parse(await fs.readFile(CONFIG, "utf8"));
await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });

const results = [];
for (const edition of config.editions) {
  const started = Date.now();
  const record = {
    ...edition,
    corpus_write: false,
    ai_generated_translation: false,
    canonical_arabic_separate: true,
    status: "not_acquired"
  };
  try {
    const response = await fetch(edition.asset_url, {
      redirect: "follow",
      headers: { accept: "application/pdf,application/octet-stream,*/*" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_BYTES) throw new Error(`asset exceeds ${MAX_BYTES} bytes`);

    if (edition.asset_kind === "pdf" && !validPdf(bytes)) {
      throw new Error("expected PDF signature %PDF-");
    }
    if (edition.asset_kind === "rar" && !validRar(bytes)) {
      throw new Error("expected RAR signature");
    }

    const actualMd5 = md5(bytes);
    if (edition.expected_md5 && actualMd5 !== edition.expected_md5) {
      throw new Error(`MD5 mismatch: expected ${edition.expected_md5}, got ${actualMd5}`);
    }

    const ext = edition.asset_kind === "pdf" ? ".pdf" : ".rar";
    const dir = path.join(OUT, edition.language_iso_code, edition.edition_id);
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${edition.edition_id}${ext}`);
    await fs.writeFile(file, bytes);

    record.acquired = {
      path: path.relative(ROOT, file),
      bytes: bytes.length,
      sha256: sha256(bytes),
      md5: actualMd5
    };
    record.status = "acquired_research_only";
  } catch (error) {
    record.error = String(error?.message || error);
  }
  record.elapsed_ms = Date.now() - started;
  await fs.writeFile(
    path.join(OUT, edition.language_iso_code, `${edition.edition_id}.metadata.json`),
    JSON.stringify(record, null, 2) + "\n",
    "utf8"
  ).catch(() => {});
  results.push(record);
}

const manifest = {
  schema_version: "2026-09-22",
  purpose: "Research-only acquisition from official institutional sources; no Corpus write and no redistribution approval.",
  corpus_write: false,
  ai_generated_translation: false,
  canonical_arabic_separate: true,
  public_publishable_only_after_rights_and_integrity: true,
  edition_count: results.length,
  acquired_editions: results.filter(x => x.status === "acquired_research_only").length,
  failed_editions: results.filter(x => x.status !== "acquired_research_only").length,
  languages: [...new Set(results.map(x => x.language_iso_code))],
  editions: results
};
await fs.writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
if (manifest.acquired_editions === 0) process.exitCode = 1;
console.log(JSON.stringify({
  edition_count: manifest.edition_count,
  acquired_editions: manifest.acquired_editions,
  failed_editions: manifest.failed_editions,
  languages: manifest.languages
}, null, 2));
