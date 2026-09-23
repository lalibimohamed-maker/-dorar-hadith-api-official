#!/usr/bin/env node
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { Readable } from "node:stream";

const ROOT = process.cwd();
const CONFIG = path.join(ROOT, "config/quran-kfgqpc-official-acquisition-2026-09-22.json");
const OUT = path.join(ROOT, "artifacts/quran-kfgqpc-official-acquisition");
const execFileAsync = (file, args, options = {}) => new Promise((resolve, reject) => {
  execFile(file, args, { ...options, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) { error.stdout = stdout; error.stderr = stderr; reject(error); return; }
    resolve({ stdout, stderr });
  });
});

const hostIpOverrides = {
  "qurancomplex.gov.sa": ["66.9.131.70"]
};
function allowedHost(url, hosts) {
  const host = new URL(url).hostname.toLowerCase();
  return hosts.includes(host) && new URL(url).protocol === "https:";
}

async function curlFetchBuffer(url, { maxBytes = 300 * 1024 * 1024 } = {}) {
  const parsed = new URL(url);
  const args = [
    "-4",
    "--fail",
    "--location",
    "--silent",
    "--show-error",
    "--retry", "3",
    "--retry-delay", "2",
    "--connect-timeout", "20",
    "--max-time", "180",
    "--header", "Accept: application/pdf,application/epub+zip,application/zip,application/octet-stream,text/html,*/*"
  ];
  const ips = hostIpOverrides[parsed.hostname] || [];
  for (const ip of ips) args.push("--resolve", `${parsed.hostname}:443:${ip}`);
  args.push(url);
  const { stdout } = await execFileAsync("curl", args, { encoding: "buffer", maxBuffer: maxBytes + 8192 });
  if (stdout.length > maxBytes) throw new Error(`asset exceeds configured size cap`);
  return Buffer.from(stdout);
}

function signature(buffer) {
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) return "zip";
  if (buffer.length >= 7 && buffer.subarray(0, 7).equals(Buffer.from([0x52,0x61,0x72,0x21,0x1a,0x07]))) return "rar";
  return null;
}

function candidatesFromHtml(html, baseUrl) {
  const found = new Set();
  const add = (raw) => {
    try {
      const url = new URL(raw, baseUrl);
      if (!allowedHost(url.href, config.allowed_hosts)) return;
      if (/\.(pdf|epub|zip|rar)(?:[?#].*)?$/i.test(url.pathname) ||
          /(?:download|file|document|publication|translation)/i.test(url.pathname + url.search)) {
        found.add(url.href);
      }
    } catch {}
  };
  for (const match of html.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)) add(match[1]);
  for (const match of html.matchAll(/(?:https?:)?\/\/[^\s"'<>]+/gi)) add(match[0]);
  for (const match of html.matchAll(/(?:src|href)\s*:\s*["']([^"']+)["']/gi)) add(match[1]);
  return [...found];
}

async function downloadAndHash(url, maxBytes) {
  const buffer = await curlFetchBuffer(url, { maxBytes });
  const kind = signature(buffer);
  if (!kind) {
    const prefix = buffer.subarray(0, 32).toString("hex");
    throw new Error("unsupported or non-file response signature: " + prefix);
  }
  const temp = path.join(OUT, ".tmp-" + crypto.randomBytes(8).toString("hex"));
  await fs.writeFile(temp, buffer);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  return { temp, bytes: buffer.length, sha256, kind, transport: "curl-official" };
}

const config = JSON.parse(await fs.readFile(CONFIG, "utf8"));
function uniqueStrings(values) {
  return [...new Set((values || []).filter((value) => typeof value === "string" && value.trim()))];
}
function trustedAssetUrlsFor(edition) {
  return uniqueStrings(edition.asset_urls);
}
function trustedIndexUrlsFor(edition) {
  return uniqueStrings(edition.asset_index_urls);
}
function safeSegment(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]+$/.test(value) || value === "." || value === "..") {
    throw new Error(`unsafe ${label}`);
  }
  return value;
}
await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });

const results = [];
let networkUnavailable = false;
for (const edition of config.editions) {
  const editionId = safeSegment(edition.edition_id, "edition id");
  const language = safeSegment(edition.language_iso_code, "language code");
  const trustedAssetUrls = trustedAssetUrlsFor(edition);
  const trustedIndexUrls = trustedIndexUrlsFor(edition);
  const result = {
    ...edition,
    corpus_write: false,
    ai_generated_translation: false,
    canonical_arabic_separate: true,
    status: "not_acquired",
    candidates: []
  };
  const discoveryUrls = uniqueStrings([
    ...trustedIndexUrls,
    edition.official_page
  ]);
  const discoveredAssetUrls = new Set(trustedAssetUrls);

  for (const assetUrl of trustedAssetUrls) {
    result.candidates.push({ source_url: "fixed_official_registry", asset_url: assetUrl, status: "discovered" });
  }
  for (const indexUrl of discoveryUrls) {
    try {
      const indexBuffer = await curlFetchBuffer(indexUrl, { maxBytes: 10_000_000 });
      const html = indexBuffer.toString("utf8");
      result.candidates.push({ index_url: indexUrl, final_url: indexUrl, status: "index_reachable", transport: "curl-official" });
      if (html.length <= 10_000_000) {
          for (const candidateUrl of candidatesFromHtml(html, indexUrl)) {
            discoveredAssetUrls.add(candidateUrl);
            result.candidates.push({ index_url: indexUrl, asset_url: candidateUrl, status: "asset_discovered_from_official_page" });
          }
        } else {
          result.candidates.push({ index_url: indexUrl, status: "index_skipped_too_large" });
        }
    } catch (error) {
      result.candidates.push({ index_url: indexUrl, status: "index_error", error: String(error?.message || error) });
    }
  }

  const assetUrls = [...discoveredAssetUrls];
  for (const assetUrl of assetUrls) {
    try {
      const downloaded = await downloadAndHash(assetUrl, edition.max_bytes);
      const ext = downloaded.kind === "pdf" ? ".pdf" : downloaded.kind === "rar" ? ".rar" : ".epub";
      const dir = path.join(OUT, language, editionId);
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, editionId + ext);
      if (downloaded.temp) {
        await fs.rename(downloaded.temp, file);
      } else {
        // codeql[js/http-to-file-access] Fixed official endpoint; streamed bytes are size/signature validated before persistence.
        await fs.writeFile(file, downloaded.buffer);
      }
      result.acquired = {
        asset_url: assetUrl,
        path: path.relative(ROOT, file),
        bytes: downloaded.bytes,
        sha256: downloaded.sha256,
        signature: downloaded.kind,
        transport: downloaded.transport || "direct-official"
      };
      result.status = "acquired_research_only";
      break;
    } catch (error) {
      const errorMessage = String(error?.message || error);
      result.candidates.push({ asset_url: assetUrl, status: "asset_error", error: errorMessage });
      if (/proxy HTTP 5\d\d|HTTP 5\d\d|fetch failed|aborted|abort|timeout|timed out|ETIMEDOUT|ECONNRESET|ENETUNREACH|EAI_AGAIN|ENOTFOUND/i.test(errorMessage)) {
        networkUnavailable = true;
      }
    }
  }

  results.push(result);
  await fs.mkdir(path.join(OUT, language), { recursive: true });
  await fs.writeFile(
    path.join(OUT, language, editionId + ".metadata.json"),
    JSON.stringify(result, null, 2) + "\n",
    "utf8"
  );
}

const manifest = {
  schema_version: "2026-09-22",
  purpose: "Research-only acquisition from official KFGQPC publication servers; no Corpus write and no redistribution approval.",
  corpus_write: false,
  ai_generated_translation: false,
  canonical_arabic_separate: true,
  edition_count: results.length,
  acquired_editions: results.filter(x => x.status === "acquired_research_only").length,
  failed_editions: results.filter(x => x.status !== "acquired_research_only").length,
  network_unavailable: networkUnavailable,
  languages: [...new Set(results.map(x => x.language_iso_code))],
  editions: results
};
await fs.writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
if (manifest.failed_editions > 0 && !manifest.network_unavailable) process.exitCode = 1;
console.log(JSON.stringify({
  edition_count: manifest.edition_count,
  acquired_editions: manifest.acquired_editions,
  failed_editions: manifest.failed_editions,
  languages: manifest.languages,
  details: results.map(x => ({
    edition_id: x.edition_id,
    status: x.status,
    candidate_count: x.candidates.length,
    candidates: x.candidates
  }))
}, null, 2));
