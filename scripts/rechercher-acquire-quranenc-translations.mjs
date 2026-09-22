#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const CATALOG = path.join(ROOT, "config/quran-multisource-translation-catalog-2026-09-22.json");
const OUT = path.join(ROOT, "artifacts/quran-translation-acquisition");
const BASE = "https://quranenc.com/api/v1";
const CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.QURANENC_CONCURRENCY || 6)));

async function getJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function mapLimit(items, worker, limit) {
  const results = new Array(items.length);
  let next = 0;
  async function runner() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try { results[i] = await worker(items[i], i); }
      catch (error) { results[i] = { error: String(error?.message || error) }; }
    }
  }
  await Promise.all(Array.from({ length: limit }, runner));
  return results;
}

const catalog = JSON.parse(await fs.readFile(CATALOG, "utf8"));
const editions = catalog.editions.filter(e => e.source_id === "quranenc");
if (editions.length !== 74) throw new Error(`Expected 74 QuranEnc editions, found ${editions.length}`);

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });

const editionResults = await mapLimit(editions, async (edition) => {
  const dir = path.join(OUT, "editions", edition.language_iso_code, edition.edition_id);
  await fs.mkdir(dir, { recursive: true });
  const surahs = Array.from({ length: 114 }, (_, i) => i + 1);
  const results = await mapLimit(surahs, async (surah) => {
    const url = `${BASE}/translation/sura/${encodeURIComponent(edition.edition_id)}/${surah}`;
    const data = await getJson(url);
    const text = JSON.stringify(data);
    const file = path.join(dir, `sura-${String(surah).padStart(3, "0")}.json`);
    await fs.writeFile(file, text + "\n", "utf8");
    return { surah, bytes: Buffer.byteLength(text), sha256: crypto.createHash("sha256").update(text).digest("hex") };
  }, CONCURRENCY);
  const failures = results.filter(x => x?.error);
  const ok = results.filter(x => !x?.error);
  return {
    source_id: edition.source_id,
    edition_id: edition.edition_id,
    language_iso_code: edition.language_iso_code,
    expected_surahs: 114,
    acquired_surahs: ok.length,
    failed_surahs: failures.map(x => x.error),
    primary_source_verification: edition.primary_source_verification,
    rights_verification: edition.rights_verification,
    corpus_write: false,
    ai_generated: false,
    status: failures.length ? "partial" : "acquired_research_only"
  };
}, 2);

const manifest = {
  schema_version: "2026-09-22",
  purpose: "Research-only acquisition of QuranEnc translation editions; never a Corpus write or redistribution grant.",
  source: "QuranEnc official API",
  canonical_arabic_separate: true,
  ai_generated_translation: false,
  corpus_write: false,
  rights_verification_required_before_publication: true,
  edition_count: editionResults.length,
  complete_editions: editionResults.filter(x => x.status === "acquired_research_only").length,
  partial_editions: editionResults.filter(x => x.status === "partial").length,
  editions: editionResults
};
await fs.writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  edition_count: manifest.edition_count,
  complete_editions: manifest.complete_editions,
  partial_editions: manifest.partial_editions,
  output: OUT
}, null, 2));
