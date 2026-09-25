#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "artifacts/quran-live-source-acquisition");
const REGISTRY = path.join(ROOT, "artifacts/quran-live-source-registry.json");
const MAX_BYTES = 200 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30000;
const MAX_PDFS_PER_SOURCE = Math.max(1, Number(process.env.QURAN_SOURCE_MAX_PDFS_PER_SOURCE || 5));
const MAX_SOURCES = Math.max(1, Number(process.env.QURAN_SOURCE_MAX_SOURCES || 1000));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha256 = b => crypto.createHash("sha256").update(b).digest("hex");
const safe = s => String(s || "unknown").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "unknown";

function isQuranSource(s) {
  const hay = [s.category, s.name, s.scope, ...(Array.isArray(s.capabilities) ? s.capabilities : []), ...(Array.isArray(s.languages) ? s.languages : [])]
    .join(" ").toLowerCase();
  return /quran|tafsir|tajwid|tajweed|qiraat|qira.?at|mushaf|ayah|quranic/.test(hay);
}

async function fetchBytes(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "DinAllah-Rechercher-QuranSource/1.0", accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.1" }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const len = Number(r.headers.get("content-length") || 0);
    if (len > MAX_BYTES) throw new Error("response exceeds size limit");
    const data = Buffer.from(await r.arrayBuffer());
    if (data.length > MAX_BYTES) throw new Error("response exceeds size limit");
    return { data, finalUrl: r.url, contentType: r.headers.get("content-type") || "" };
  } finally { clearTimeout(timer); }
}

function extractLinks(html, base) {
  const out = new Set();
  const re = /(?:href|src|data-href|data-url)=["']([^"']+)["']/gi;
  for (const m of html.matchAll(re)) {
    try {
      const u = new URL(m[1], base);
      if (u.protocol === "https:" && /\.pdf(?:[?#]|$)/i.test(u.pathname + u.search)) out.add(u.href);
    } catch {}
  }
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>]+\.pdf(?:[?#][^\s"'<>]*)?/gi)) {
    try { const u = new URL(m[0]); if (u.protocol === "https:") out.add(u.href); } catch {}
  }
  return [...out];
}

await fs.mkdir(OUT, { recursive: true });
const registry = JSON.parse(await fs.readFile(REGISTRY, "utf8"));
const allSources = Array.isArray(registry.sources) ? registry.sources : [];
const sources = allSources.filter(isQuranSource).slice(0, MAX_SOURCES);
const manifest = {
  schema: "rechercher/quran-live-source-acquisition/v1",
  generated_at: new Date().toISOString(),
  source_registry: registry.source_registry_ref || "PR #561 live registry",
  source_registry_links: allSources.length,
  quran_source_count: sources.length,
  corpus_write: false,
  ai_generated_translation: false,
  canonical_arabic_separate: true,
  rights_status: "review_required",
  files: [],
  sources: [],
  errors: []
};

for (const source of sources) {
  const row = { id: source.id, name: source.name, category: source.category, url: source.url, discovered_pdf_urls: [], acquired_pdf_count: 0 };
  try {
    const page = await fetchBytes(source.url);
    const html = page.data.subarray(0, 5).toString("ascii") === "%PDF-" ? "" : page.data.toString("utf8");
    const base = page.finalUrl || source.url;
    const origin = new URL(base).origin;
    const links = html ? extractLinks(html, base).filter(u => new URL(u).origin === origin) : (/\.pdf(?:$|[?#])/i.test(base) ? [base] : []);
    row.discovered_pdf_urls = [...new Set(links)].slice(0, MAX_PDFS_PER_SOURCE);
    for (const url of row.discovered_pdf_urls) {
      try {
        const asset = await fetchBytes(url);
        if (asset.data.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("candidate is not a PDF");
        const parsed = new URL(url);
        const dir = path.join(OUT, "pdf", safe(source.id));
        await fs.mkdir(dir, { recursive: true });
        const filename = safe(path.basename(parsed.pathname) || source.id) + ".pdf";
        const dest = path.join(dir, filename);
        await fs.writeFile(dest, asset.data);
        const digest = sha256(asset.data);
        manifest.files.push({
          source_id: source.id,
          source_name: source.name,
          source_url: source.url,
          asset_url: url,
          path: path.relative(ROOT, dest),
          bytes: asset.data.length,
          sha256: digest,
          acquisition: "research-only",
          rights: "review-required",
          content_policy: "preserve-verbatim"
        });
        row.acquired_pdf_count++;
      } catch (e) {
        manifest.errors.push({ source_id: source.id, url, stage: "pdf-acquisition", error: String(e.message || e) });
      }
    }
  } catch (e) {
    manifest.errors.push({ source_id: source.id, url: source.url, stage: "source-discovery", error: String(e.message || e) });
  }
  manifest.sources.push(row);
  console.log(`QURAN_SOURCE_PROGRESS id=${source.id} pdfs=${row.acquired_pdf_count} discovered=${row.discovered_pdf_urls.length}`);
  await sleep(100);
}

manifest.total_unique_sha256 = new Set(manifest.files.map(x => x.sha256)).size;
await fs.writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({
  quran_source_count: manifest.quran_source_count,
  discovered_pdf_urls: manifest.sources.reduce((n, x) => n + x.discovered_pdf_urls.length, 0),
  acquired_pdf_count: manifest.files.length,
  total_unique_sha256: manifest.total_unique_sha256,
  errors: manifest.errors.length
}, null, 2));
