#!/usr/bin/env node
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { validateRepairAndQualityGate } from "./rechercher_docx_pdf_fallback.mjs";

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
async function isDocx(file) {
  try {
    await execFileAsync("python3", ["-c",[
      "import sys,zipfile",
      "p=sys.argv[1]",
      "assert zipfile.is_zipfile(p)",
      "z=zipfile.ZipFile(p)",
      "n=set(z.namelist())",
      "assert '[Content_Types].xml' in n and 'word/document.xml' in n"
    ].join(";"),file]);
    return true;
  } catch { return false; }
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
const seenSha256 = new Map();
await fs.mkdir(OUT, { recursive: true });

async function acquireEdition(edition) {
  const editionId = safeSegment(edition.edition_id, "edition id");
  const language = safeSegment(edition.language_iso_code, "language code");
  const existingMetadataPath = path.join(OUT, language, editionId + ".metadata.json");
  try {
    const existing = JSON.parse(await fs.readFile(existingMetadataPath, "utf8"));
    if (existing.status === "acquired_research_only" && existing.acquired?.path) {
      await fs.access(path.join(ROOT, existing.acquired.path));
      if (existing.acquired.sha256) seenSha256.set(existing.acquired.sha256, { edition_id: editionId, path: existing.acquired.path });
      return { ...existing, resumed: true };
    }
  } catch {}
  const result = { ...edition, corpus_write:false, ai_generated_translation:false, canonical_arabic_separate:true, status:"not_acquired", candidates:[] };
  const discovered = new Set(uniqueStrings(edition.asset_urls));
  const indexes = uniqueStrings([edition.official_page, ...(edition.asset_index_urls || [])]);

  for (const indexUrl of indexes) {
    try {
      if (!allowedHost(indexUrl, config.allowed_hosts)) throw new Error("index host/protocol rejected");
      const tmp = path.join(OUT, `.index-${crypto.randomBytes(6).toString("hex")}`);
      await curlToFile(indexUrl, tmp, 45);
      // Keep validation and reading on the same open descriptor to avoid a TOCTOU race.
      const handle = await fs.open(tmp, "r");
      try {
        const stat = await handle.stat();
        if (stat.size > 10_000_000) throw new Error("index exceeds 10 MB cap");
        const html = await handle.readFile("utf8");
        result.candidates.push({index_url:indexUrl,status:"index_reachable",transport:"curl-official"});
        for (const u of candidatesFromHtml(html,indexUrl)) discovered.add(u);
      } finally {
        await handle.close();
        await fs.rm(tmp, { force:true });
      }
    } catch (e) {
      result.candidates.push({index_url:indexUrl,status:"index_error",error:String(e?.message||e)});
    }
  }

  // Do not truncate official candidates: every discovered official asset URL must be tested.
  const assetUrls = [...discovered];
  for (const assetUrl of assetUrls) {
    const temp = path.join(OUT, `.asset-${crypto.randomBytes(8).toString("hex")}`);
    try {
      if (!allowedHost(assetUrl, config.allowed_hosts)) throw new Error("asset host/protocol rejected");
      await curlToFile(assetUrl, temp, 120);
      let meta = await sha256AndSignature(temp);
      let derivedFromDocx = null;
      if (meta.signature === "zip" && await isDocx(temp)) {
        const pdfTemp = temp + ".converted.pdf";
        try {
          await execFileAsync("libreoffice", [
            "--headless","--nologo","--nodefault","--nolockcheck","--norestore",
            "--convert-to","pdf:writer_pdf_Export","--outdir",path.dirname(pdfTemp),temp
          ], { timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
          const produced = path.join(path.dirname(pdfTemp),path.basename(temp).replace(/\.converted\.pdf$/i,".pdf"));
          if (produced !== pdfTemp) await fs.rename(produced,pdfTemp);
          await validateRepairAndQualityGate(pdfTemp);
          const pdfMeta = await sha256AndSignature(pdfTemp);
          if (pdfMeta.signature !== "pdf") throw new Error("DOCX conversion did not yield PDF");
          derivedFromDocx = { sha256: meta.sha256, bytes: meta.bytes, source_path: path.relative(ROOT,temp) };
          await fs.rm(temp,{force:true});
          await fs.rename(pdfTemp,temp);
          meta = {...pdfMeta, derived_from_docx: derivedFromDocx};
        } finally {
          await fs.rm(pdfTemp,{force:true});
        }
      }
      if (meta.bytes > edition.max_bytes) throw new Error("asset exceeds configured size cap");
      const duplicateOf = seenSha256.get(meta.sha256);
      if (duplicateOf) {
        result.acquired = {asset_url:assetUrl,path:duplicateOf.path,...meta,transport:"curl-official",deduplicated:true,duplicate_of:duplicateOf.edition_id};
        result.status = "acquired_research_only";
        result.candidates.push({asset_url:assetUrl,status:"duplicate_sha256",sha256:meta.sha256,duplicate_of:duplicateOf.edition_id});
        await fs.rm(temp,{force:true});
        break;
      }
      const ext = meta.signature === "pdf" ? ".pdf" : meta.signature === "rar" ? ".rar" : ".epub";
      const dir = path.join(OUT, language, editionId);
      await fs.mkdir(dir,{recursive:true});
      const file = path.join(dir, editionId + ext);
      await fs.rename(temp,file);
      const relativePath = path.relative(ROOT,file);
      seenSha256.set(meta.sha256,{edition_id:editionId,path:relativePath});
      result.acquired = {asset_url:assetUrl,path:relativePath,...meta,transport:"curl-official",format:meta.signature==="pdf"?"pdf":meta.signature};
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
  editions:results,
  last_completed_language: [...results].reverse().find(x => x.status === "acquired_research_only")?.language_iso_code || null,
  resume_supported: true
};
await fs.writeFile(path.join(OUT,"manifest.json"),JSON.stringify(manifest,null,2)+"\n","utf8");
console.log(JSON.stringify({
  edition_count:manifest.edition_count, acquired_editions:manifest.acquired_editions,
  failed_editions:manifest.failed_editions, network_unavailable:manifest.network_unavailable,
  details:results.map(r=>({edition_id:r.edition_id,status:r.status,candidate_count:r.candidates.length}))
},null,2));
if (manifest.failed_editions > 0 && !manifest.network_unavailable) process.exitCode = 1;
