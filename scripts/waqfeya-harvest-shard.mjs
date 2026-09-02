#!/usr/bin/env node
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const INDEX_PATH = process.env.INDEX_PATH ?? 'data/corpus/waqfeya/century-15/index.jsonl';
const START = Number(process.env.BOOK_START ?? '0');
const COUNT = Number(process.env.BOOK_COUNT ?? '100');
const SHARD_ID = String(process.env.SHARD_ID ?? `start-${START}`);
const OUT_DIR = `artifacts/waqfeya/${SHARD_ID}`;
const PDF_DIR = `${OUT_DIR}/pdf`; // PDFs remain runner-local unless an explicitly configured publisher is added later.
const USER_AGENT = 'Deen-Allah-Encyclopedia-Waqfeya-Harvester/2026';
const ALLOWED_DOWNLOAD_HOSTS = new Set(['waqfeya.net', 'www.waqfeya.net', 'archive.org', 'www.archive.org']);

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function safeUrl(raw, { allowDownloadHost = false } = {}) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    if (allowDownloadHost ? !ALLOWED_DOWNLOAD_HOSTS.has(url.hostname) : !['waqfeya.net', 'www.waqfeya.net'].includes(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function extractDirectPdfLinks(html, pageUrl) {
  const links = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(re)) {
    const href = match[1];
    const label = htmlToText(match[2]);
    let resolved;
    try { resolved = new URL(href, pageUrl).href; } catch { continue; }
    if (!safeUrl(resolved, { allowDownloadHost: true })) continue;
    const lower = `${label} ${resolved}`.toLowerCase();
    if (/pdf|تحميل|الكتاب|download|archive\.org/.test(lower)) links.push(resolved);
  }
  return [...new Set(links)];
}

function extractRightsEvidence(text) {
  const normalized = text.replace(/\s+/g, ' ');
  const positivePatterns = [
    /وقف\s*(لله|لله تعالى|الله تعالى|خيرى)/u,
    /وقف(?:ية)?/u,
    /يوزّع\s+مجان(?:ا|اً)/u,
    /يوزع\s+مجانا/u,
    /متاح\s+للتوزيع\s+المجان(?:ي|ة)/u,
    /public\s+domain/i,
    /creative\s+commons/i,
    /creativecommons/i,
    /ترخيص\s+مفتوح/u,
    /إذن\s+بالنشر/u,
    /إتاحة\s+حرة/u,
  ];
  const restrictivePatterns = [
    /جميع\s+الحقوق\s+محفوظة/u,
    /all\s+rights\s+reserved/i,
    /لا\s+يجوز\s+إعادة\s+النشر/u,
    /يمنع\s+إعادة\s+النشر/u,
  ];
  const positives = positivePatterns.filter((re) => re.test(normalized)).map((re) => re.source);
  const restrictions = restrictivePatterns.filter((re) => re.test(normalized)).map((re) => re.source);
  return {
    eligible: positives.length > 0 && restrictions.length === 0,
    positiveSignals: positives,
    restrictiveSignals: restrictions,
  };
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.text();
}

async function downloadFile(url, out) {
  const child = spawn('curl', [
    '--fail', '--location', '--silent', '--show-error', '--retry', '5',
    '--retry-delay', '2', '--connect-timeout', '30', '--max-time', '1200',
    '--user-agent', USER_AGENT, '--output', out, url,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  const code = await new Promise((resolve) => child.on('close', resolve));
  if (code !== 0) throw new Error(`curl exit ${code}: ${stderr.trim().slice(-600)}`);
}

async function fileLooksLikePdf(path) {
  const fs = await import('node:fs/promises');
  const handle = await fs.open(path, 'r');
  try {
    const buffer = Buffer.alloc(5);
    await handle.read(buffer, 0, 5, 0);
    return buffer.toString('ascii') === '%PDF-';
  } finally {
    await handle.close();
  }
}

async function sha256File(path) {
  const hash = createHash('sha256');
  const stream = (await import('node:fs')).createReadStream(path);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

async function pLimit(items, limit, fn) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item === undefined) return;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

async function main() {
  if (!Number.isInteger(START) || START < 0 || !Number.isInteger(COUNT) || COUNT < 1 || COUNT > 100) {
    throw new Error('BOOK_START must be >= 0 and BOOK_COUNT must be between 1 and 100');
  }
  const raw = await readFile(INDEX_PATH, 'utf8');
  const records = raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const slice = records.slice(START, START + COUNT);
  await mkdir(PDF_DIR, { recursive: true });
  const results = [];

  await pLimit(slice, 4, async (book) => {
    const startedAt = new Date().toISOString();
    const result = {
      index: book.index,
      id: book.id,
      titleHint: book.titleHint,
      sourcePage: book.sourcePage,
      sourceIndex: book.sourceIndex,
      startedAt,
      status: 'pending',
    };

    try {
      const pageUrl = safeUrl(book.sourcePage);
      if (!pageUrl) throw new Error('invalid Waqfeya source URL');
      const html = await fetchHtml(pageUrl);
      const text = htmlToText(html);
      const rights = extractRightsEvidence(text);
      result.rights = rights;
      if (!rights.eligible) {
        result.status = 'rights-not-proven';
        result.finishedAt = new Date().toISOString();
        results.push(result);
        return;
      }

      const candidates = extractDirectPdfLinks(html, pageUrl);
      if (!candidates.length) {
        result.status = 'eligible-but-no-direct-pdf-found';
        result.finishedAt = new Date().toISOString();
        results.push(result);
        return;
      }

      let lastError = 'no candidate succeeded';
      for (const downloadUrl of candidates) {
        const out = `${PDF_DIR}/${book.id}.pdf`;
        try {
          await downloadFile(downloadUrl, out);
          if (!(await fileLooksLikePdf(out))) throw new Error('downloaded file is not a PDF');
          const stat = await (await import('node:fs/promises')).stat(out);
          const sha256 = await sha256File(out);
          result.status = 'downloaded-and-verified';
          result.downloadUrl = downloadUrl;
          result.bytes = stat.size;
          result.sha256 = sha256;
          result.finishedAt = new Date().toISOString();
          results.push(result);
          return;
        } catch (error) {
          lastError = error.message;
          await rm(out, { force: true });
        }
      }
      result.status = 'download-failed';
      result.error = lastError;
      result.finishedAt = new Date().toISOString();
      results.push(result);
    } catch (error) {
      result.status = 'page-processing-failed';
      result.error = error.message;
      result.finishedAt = new Date().toISOString();
      results.push(result);
    }
  });

  results.sort((a, b) => a.index - b.index);
  const verified = results.filter((r) => r.status === 'downloaded-and-verified');
  const summary = {
    shardId: SHARD_ID,
    requestedStart: START,
    requestedCount: COUNT,
    actualCount: slice.length,
    verifiedCount: verified.length,
    rightsNotProvenCount: results.filter((r) => r.status === 'rights-not-proven').length,
    failedCount: results.filter((r) => r.status.includes('failed')).length,
    generatedAt: new Date().toISOString(),
    persistence: 'PDFs are intentionally runner-local; this job persists only metadata and cryptographic evidence unless a separately configured storage publisher is approved.',
  };
  await writeFile(`${OUT_DIR}/manifest.json`, `${JSON.stringify({ shard: summary, books: results }, null, 2)}\n`, 'utf8');
  await writeFile(`${OUT_DIR}/summary.json`, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  const hashRows = verified.map((r) => `${r.sha256}  ${r.id}.pdf`).join('\n');
  await writeFile(`${OUT_DIR}/pdfs.sha256`, hashRows ? `${hashRows}\n` : '', 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
