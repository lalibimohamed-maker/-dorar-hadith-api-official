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
const proxyTransportUrl = (url) =>
  "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);

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

async function proxyFetchBuffer(url, { maxBytes = 300 * 1024 * 1024 } = {}) {
  const proxied = proxyTransportUrl(url);
  const response = await fetch(proxied, {
    redirect: "follow",
    headers: { accept: "application/pdf,application/epub+zip,application/zip,application/octet-stream,*/*" }
  });
  if (!response.ok) throw new Error("proxy HTTP " + response.status);
  if (!response.body) throw new Error("proxy response body unavailable");
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared && declared > maxBytes) throw new Error("proxied asset exceeds configured size cap");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) throw new Error("proxied asset exceeds configured size cap");
  return bytes;
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
  const response = await fetch(url, {
    redirect: "follow",
    headers: { accept: "application/pdf,application/epub+zip,application/zip,application/octet-stream,text/html,*/*" }
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  if (!response.body) throw new Error("response body unavailable");
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared && declared > maxBytes) throw new Error("asset exceeds configured size cap");
  const temp = path.join(OUT, ".tmp-" + crypto.randomBytes(8).toString("hex"));
  const file = createWriteStream(temp);
  const hash = crypto.createHash("sha256");
  let bytes = 0;
  let first = Buffer.alloc(0);
  try {
    for await (const chunk of Readable.fromWeb(response.body)) {
      const buf = Buffer.from(chunk);
      bytes += buf.length;
      if (bytes > maxBytes) throw new Error("asset exceeds configured size cap");
      if (first.length < 8192) first = Buffer.concat([first, buf.subarray(0, 8192 - first.length)]);
      hash.update(buf);
      if (!file.write(buf)) await new Promise((resolve, reject) => {
        file.once("drain", resolve);
        file.once("error", reject);
      });
    }
    await new Promise((resolve, reject) => { file.end(resolve); file.once("error", reject); });
    const kind = signature(first);
    if (!kind) {
      const prefix = first.subarray(0, 32).toString("hex");
      throw new Error("unsupported or non-file response signature: " + prefix);
    }
    return { temp, bytes, sha256: hash.digest("hex"), kind };
  } catch (error) {
    file.destroy();
    await fs.rm(temp, { force: true });
    throw error;
  }
}

const config = JSON.parse(await fs.readFile(CONFIG, "utf8"));
await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });

const results = [];
for (const edition of config.editions) {
  const result = {
    ...edition,
    corpus_write: false,
    ai_generated_translation: false,
    canonical_arabic_separate: true,
    status: "not_acquired",
    candidates: []
  };
  const discoveryUrls = [];
  if (!(edition.asset_urls && edition.asset_urls.length)) {
    if (edition.official_page) discoveryUrls.push(edition.official_page);
    discoveryUrls.push(...edition.asset_index_urls);
  }
  for (const assetUrl of (edition.asset_urls || [])) {
    if (allowedHost(assetUrl, config.allowed_hosts)) {
      result.candidates.push({ source_url: "explicit_official_asset", asset_url: assetUrl, status: "discovered" });
    } else {
      result.candidates.push({ source_url: "explicit_official_asset", asset_url: assetUrl, status: "rejected_host" });
    }
  }
  for (const indexUrl of discoveryUrls) {
    if (!allowedHost(indexUrl, config.allowed_hosts)) {
      result.candidates.push({ index_url: indexUrl, status: "rejected_host" });
      continue;
    }
    try {
      let html;
      let finalUrl = indexUrl;
      let contentType = "";
      try {
        const response = await fetch(indexUrl, {
          redirect: "follow",
          headers: { accept: "text/html,application/xhtml+xml,*/*" }
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        contentType = (response.headers.get("content-type") || "").toLowerCase();
        finalUrl = response.url;
        html = await response.text();
      } catch (error) {
        const host = new URL(indexUrl).hostname;
        if (!(hostIpOverrides[host] || []).length) throw error;
        let bytes;
        try {
          bytes = await curlFetchBuffer(indexUrl, { maxBytes: 10 * 1024 * 1024 });
        } catch {
          bytes = await proxyFetchBuffer(indexUrl, { maxBytes: 10 * 1024 * 1024 });
        }
        contentType = "text/html";
        html = bytes.toString("utf8");
      }
      if (contentType.includes("text/html") || finalUrl.endsWith("/")) {
        const candidateUrls = candidatesFromHtml(html, finalUrl);
        if (candidateUrls.length === 0) {
          result.candidates.push({ index_url: indexUrl, final_url: finalUrl, status: "index_ok_no_supported_asset_links" });
          continue;
        }
        for (const assetUrl of candidateUrls) {
          result.candidates.push({ source_url: indexUrl, asset_url: assetUrl, status: "discovered" });
        }
      } else if (allowedHost(finalUrl, config.allowed_hosts)) {
        result.candidates.push({ source_url: indexUrl, asset_url: finalUrl, status: "discovered" });
      }
    } catch (error) {
      result.candidates.push({ index_url: indexUrl, status: "index_error", error: String(error?.message || error) });
    }
  }

  const assetUrls = [...new Set(result.candidates.filter(x => x.status === "discovered").map(x => x.asset_url))];
  for (const assetUrl of assetUrls) {
    try {
      let downloaded;
      try {
        downloaded = await downloadAndHash(assetUrl, edition.max_bytes);
      } catch (error) {
        const host = new URL(assetUrl).hostname;
        if (!(hostIpOverrides[host] || []).length) throw error;
        let bytes;
        let transport = "official-ipv4-fallback";
        try {
          bytes = await curlFetchBuffer(assetUrl, { maxBytes: edition.max_bytes });
        } catch {
          bytes = await proxyFetchBuffer(assetUrl, { maxBytes: edition.max_bytes });
          transport = "official-url-via-allorigins-transport-proxy";
        }
        const kind = signature(bytes);
        if (!kind) throw new Error("unsupported or non-file response signature via curl fallback");
        downloaded = {
          temp: null,
          bytes: bytes.length,
          sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
          kind,
          buffer: bytes,
          transport
        };
      }
      const ext = downloaded.kind === "pdf" ? ".pdf" : downloaded.kind === "rar" ? ".rar" : ".epub";
      const dir = path.join(OUT, edition.language_iso_code, edition.edition_id);
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, edition.edition_id + ext);
      if (downloaded.temp) {
        await fs.rename(downloaded.temp, file);
      } else {
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
      result.candidates.push({ asset_url: assetUrl, status: "asset_error", error: String(error?.message || error) });
    }
  }

  results.push(result);
  await fs.mkdir(path.join(OUT, edition.language_iso_code), { recursive: true });
  await fs.writeFile(
    path.join(OUT, edition.language_iso_code, edition.edition_id + ".metadata.json"),
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
  languages: [...new Set(results.map(x => x.language_iso_code))],
  editions: results
};
await fs.writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
if (manifest.failed_editions > 0) process.exitCode = 1;
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
