#!/usr/bin/env node
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const ROOT = process.cwd();
const CONFIG = path.join(ROOT, "config/quran-kfgqpc-official-acquisition-2026-09-22.json");
const OUT = path.join(ROOT, "artifacts/quran-kfgqpc-official-acquisition");
const execFileAsync = promisify(execFile);

const hostIpOverrides = { "qurancomplex.gov.sa": ["66.9.131.70"] };

function allowedHost(rawUrl, hosts) {
  const u = new URL(rawUrl);
  return u.protocol === "https:" && hosts.includes(u.hostname.toLowerCase());
}
function safeSegment(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]+$/.test(value) || value === "." || value === "..") {
    throw new Error(`unsafe ${label}`);
  }
  return value;
}
function uniqueStrings(values) {
  return [...new Set((values || []).filter(v => typeof v === "string" && v.trim()))];
}
function signatureFromPrefix(buffer) {
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x50,0x4b,0x03,0x04]))) return "zip";
  if (buffer.length >= 7 && buffer.subarray(0, 7).equals(Buffer.from([0x52,0x61,0x72,0x21,0x1a,0x07]))) return "rar";
  return null;
}
async function curlToFile(url, file, maxSeconds) {
  if (!allowedHost(url, config.allowed_hosts)) throw new Error("URL host/protocol rejected");
  const parsed = new URL(url);
  const args = [
    "-4","--fail","--location","--silent","--show-error",
    "--retry","2","--retry-delay","2","--connect-timeout","15",
    "--max-time",String(maxSeconds),
    "--header","Accept: application/pdf,application/epub+zip,application/zip,application/octet-stream,*/*"
  ];
  for (const ip of (hostIpOverrides[parsed.hostname] || [])) args.push("--resolve", `${parsed.hostname}:443:${ip}`);
  // The URL is validated against the fixed official-host allowlist before being passed as a curl argument.
  args.push("--output", file, url);
  await execFileAsync("curl", args, { maxBuffer: 2 * 1024 * 1024 });
}
async function sha256AndSignature(file) {
  const fd = await fs.open(file, "r");
  const head = Buffer.alloc(16);
  await fd.read(head, 0, head.length, 0);
  await fd.close();
  const signature = signatureFromPrefix(head);
  if (!signature) throw new Error("unsupported or non-file response signature");
  const hash = crypto.createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(file)) { hash.update(chunk); bytes += chunk.length; }
  return { bytes, sha256: hash.digest("hex"), signature };
}
function candidatesFromHtml(html, baseUrl) {
  const found = new Set();
  const add = raw => {
    try {
      const u = new URL(raw, baseUrl);
      if (!allowedHost(u.href, config.allowed_hosts)) return;
      if (/\.(pdf|epub|zip|rar)(?:[?#].*)?$/i.test(u.pathname) ||
          /(?:download|file|document|publication|translation)/i.test(u.pathname + u.search)) found.add(u.href);
    } catch {}
  };
  for (const m of html.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)) add(m[1]);
  for (const m of html.matchAll(/(?:https?:)?\/\/[^\s"'<>]+/gi)) add(m[0]);
  return [...found];
}

const config = JSON.parse(await fs.readFile(CONFIG, "utf8"));
await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });

async function acquireEdition(edition) {
  const editionId = safeSegment(edition.edition_id, "edition id");
  const language = safeSegment(edition.language_iso_code, "language code");
  const result = { ...edition, corpus_write:false, ai_generated_translation:false, canonical_arabic_separate:true, status:"not_acquired", candidates:[] };
  const discovered = new Set(uniqueStrings(edition.asset_urls));
  const indexes = uniqueStrings([edition.official_page, ...(edition.asset_index_urls || [])]);

  for (const indexUrl of indexes) {
    try {
      if (!allowedHost(indexUrl, config.allowed_hosts)) throw new Error("index host/protocol rejected");
      const tmp = path.join(OUT, `.index-${crypto.randomBytes(6).toString("hex")}`);
      await curlToFile(indexUrl, tmp, 45);
      const stat = await fs.stat(tmp);
      if (stat.size > 10_000_000) throw new Error("index exceeds 10 MB cap");
      const html = await fs.readFile(tmp, "utf8");
      await fs.rm(tmp, { force:true });
      result.candidates.push({index_url:indexUrl,status:"index_reachable",transport:"curl-official"});
      for (const u of candidatesFromHtml(html,indexUrl)) discovered.add(u);
    } catch (e) {
      result.candidates.push({index_url:indexUrl,status:"index_error",error:String(e?.message||e)});
    }
  }

  // Do not truncate official candidates: every discovered official asset URL must be tested.
  for (const assetUrl of assetUrls) {
    const temp = path.join(OUT, `.asset-${crypto.randomBytes(8).toString("hex")}`);
    try {
      if (!allowedHost(assetUrl, config.allowed_hosts)) throw new Error("asset host/protocol rejected");
      await curlToFile(assetUrl, temp, 120);
      const meta = await sha256AndSignature(temp);
      if (meta.bytes > edition.max_bytes) throw new Error("asset exceeds configured size cap");
      const ext = meta.signature === "pdf" ? ".pdf" : meta.signature === "rar" ? ".rar" : ".epub";
      const dir = path.join(OUT, language, editionId);
      await fs.mkdir(dir,{recursive:true});
      const file = path.join(dir, editionId + ext);
      await fs.rename(temp,file);
      result.acquired = {asset_url:assetUrl,path:path.relative(ROOT,file),...meta,transport:"curl-official"};
      result.status = "acquired_research_only";
      break;
    } catch (e) {
      result.candidates.push({asset_url:assetUrl,status:"asset_error",error:String(e?.message||e)});
      await fs.rm(temp,{force:true});
    }
  }

  const dir = path.join(OUT, language);
  await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,editionId+".metadata.json"),JSON.stringify(result,null,2)+"\n","utf8");
  return result;
}

const editions = config.editions || [];
const results = [];
const concurrency = Math.min(3, Math.max(1, Number(process.env.KFGQPC_CONCURRENCY || 3)));
let next = 0;
async function worker() {
  while (true) {
    const i = next++;
    if (i >= editions.length) return;
    results[i] = await acquireEdition(editions[i]);
  }
}
await Promise.all(Array.from({length:concurrency},worker));

const networkUnavailable = results.some(r => r.status !== "acquired_research_only" &&
  r.candidates.some(c => /proxy HTTP 5\d\d|HTTP 5\d\d|fetch failed|aborted|abort|timeout|timed out|ETIMEDOUT|ECONNRESET|ENETUNREACH|EAI_AGAIN|ENOTFOUND/i.test(c.error || "")));

const manifest = {
  schema_version:"2026-09-22",
  purpose:"Research-only acquisition from official KFGQPC publication servers; no Corpus write and no redistribution approval.",
  corpus_write:false, ai_generated_translation:false, canonical_arabic_separate:true,
  edition_count:results.length,
  acquired_editions:results.filter(r=>r.status==="acquired_research_only").length,
  failed_editions:results.filter(r=>r.status!=="acquired_research_only").length,
  network_unavailable:networkUnavailable,
  languages:[...new Set(results.map(r=>r.language_iso_code))],
  editions:results
};
await fs.writeFile(path.join(OUT,"manifest.json"),JSON.stringify(manifest,null,2)+"\n","utf8");
console.log(JSON.stringify({
  edition_count:manifest.edition_count, acquired_editions:manifest.acquired_editions,
  failed_editions:manifest.failed_editions, network_unavailable:manifest.network_unavailable,
  details:results.map(r=>({edition_id:r.edition_id,status:r.status,candidate_count:r.candidates.length}))
},null,2));
if (manifest.failed_editions > 0 && !manifest.network_unavailable) process.exitCode = 1;
