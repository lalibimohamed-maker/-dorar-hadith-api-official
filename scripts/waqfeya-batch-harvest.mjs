import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';

const root = process.cwd();
const out = path.join(root, 'artifacts', 'waqfeya-books');
fs.mkdirSync(out, { recursive: true });

const batchSize = Math.max(1, Number(process.env.WAQFEYA_BATCH_SIZE || 25));
const start = Math.max(1, Number(process.env.WAQFEYA_START || 1));
const pages = Math.max(1, Number(process.env.WAQFEYA_PAGES || 8));
const bookIdBatch = Math.max(batchSize, Number(process.env.WAQFEYA_BOOK_ID_BATCH || pages * 50));
const proofUrls = String(process.env.WAQFEYA_PROOF_URLS || '').split(/\s+/u).filter(Boolean);
const maxDownloadBytes = Math.max(1, Number(process.env.WAQFEYA_MAX_DOWNLOAD_MB || 200)) * 1024 * 1024;

const USER_AGENT = 'Mozilla/5.0 (compatible; DeenAllahEncyclopedia/2026; +https://github.com/lalibimohamed-maker/-dorar-hadith-api-official)';

function curlText(url) {
  const args = ['-L', '--fail', '--silent', '--show-error', '--retry', '4', '--connect-timeout', '30', '--max-time', '90', '-A', USER_AGENT, url];
  return execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
}

function curlFile(url, output) {
  const args = ['-L', '--fail', '--silent', '--show-error', '--retry', '4', '--connect-timeout', '30', '--max-time', '180', '--max-filesize', String(maxDownloadBytes), '-A', USER_AGENT, '-o', output, url];
  execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
}

function safeName(value) {
  return String(value).replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 140);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function absolute(base, href) {
  try { return new URL(href, base).href; } catch { return null; }
}

function htmlDecode(value) {
  return String(value)
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ')
    .trim();
}

function titleFromHtml(html, fallback) {
  const patterns = [
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const text = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text) return htmlDecode(text).replace(/\s*[-|–—]\s*المكتبة الوقفية.*$/u, '').trim();
    }
  }
  return fallback;
}

function extractDownloadUrls(html, base) {
  const urls = [];
  const add = (href, label = '') => {
    if (!href) return;
    const decoded = htmlDecode(String(href).replaceAll('\\/', '/'));
    const resolved = absolute(base, decoded);
    if (!resolved || !/^https?:\/\//iu.test(resolved)) return;
    const signal = `${resolved} ${label}`;
    if (/\.pdf(?:$|[?#])/iu.test(resolved) || /تحميل\s+الكتاب|تحميل|download|pdf|مجلد/iu.test(signal)) urls.push(resolved);
  };

  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = m[1] || '';
    const label = (m[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const href = (attrs.match(/\bhref=["']([^"']+)["']/i) || [])[1];
    add(href, label);
  }

  for (const m of html.matchAll(/(?:href|src|url|downloadUrl|download_url|file)=["']([^"']+)["']/gi)) add(m[1]);
  for (const m of html.matchAll(/["'](https?:\/\/archive\.org\/(?:download|details)\/[^"']+)["']/gi)) add(m[1]);

  return [...new Set(urls)];
}

function isPdfFile(file) {
  if (!fs.existsSync(file)) return false;
  const stat = fs.statSync(file);
  if (stat.size < 5) return false;
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(5);
    fs.readSync(fd, buf, 0, 5, 0);
    return buf.toString('ascii') === '%PDF-';
  } finally {
    fs.closeSync(fd);
  }
}

function canonicalFromHtml(html, fallback) {
  const m = html.match(/https?:\/\/waqfeya\.net\/books\/[^"'\s<]+/iu);
  return m?.[0] || fallback;
}

async function fetchBookUrl(url, forcedBookId = null) {
  let html;
  try {
    html = curlText(url);
  } catch (error) {
    return { bookId: forcedBookId, status: 'unavailable', sourcePage: url, reason: `book-fetch:${error.message}` };
  }

  if (!/المكتبة الوقفية|waqfeya/iu.test(html)) {
    return { bookId: forcedBookId, status: 'not-a-waqfeya-page', sourcePage: url };
  }

  const sourcePage = canonicalFromHtml(html, url);
  const fallbackTitle = forcedBookId ? `Waqfeya book ${forcedBookId}` : 'Waqfeya book';
  const title = titleFromHtml(html, fallbackTitle);
  const rights = html.match(/(وقف\s+لله(?:\s+تعالى)?|وقف\s+على\s+طلبة\s+العلم|متاح\s+للتوزيع\s+بحرية|توزيع\s+حر)/u);
  const downloadUrls = extractDownloadUrls(html, sourcePage);

  if (!rights) return { bookId: forcedBookId, status: 'rights-not-explicit', title, sourcePage, downloadUrls };
  if (!downloadUrls.length) return { bookId: forcedBookId, status: 'rights-ok-no-download-link', title, sourcePage, rightsEvidence: rights[1] };

  return { bookId: forcedBookId, status: 'candidate', title, sourcePage, rightsEvidence: rights[1], downloadUrls };
}

async function fetchBook(bookId) {
  return fetchBookUrl(`https://waqfeya.net/book.php?bid=${bookId}`, bookId);
}

const discovered = [];
const skipped = [];
let existingPagesFetched = 0;
let rightsChecked = 0;
let downloadLinksFound = 0;
let downloaded = 0;
let proofCandidates = 0;

// 1) Deterministic proof: known real book page(s), independent of numeric book IDs.
for (const url of proofUrls) {
  const result = await fetchBookUrl(url);
  proofCandidates += 1;
  if (['candidate', 'rights-ok-no-download-link', 'rights-not-explicit'].includes(result.status)) existingPagesFetched += 1;
  if (result.status === 'candidate') {
    rightsChecked += 1;
    downloadLinksFound += result.downloadUrls.length;
    discovered.push({ ...result, proof: true });
  } else {
    skipped.push({ ...result, proof: true });
  }
}

// 2) Bulk scan: keep probing numeric IDs so one broken/empty range does not stop the campaign.
if (discovered.filter((x) => x.proof).length < batchSize) {
  for (let offset = 0; offset < bookIdBatch; offset += 1) {
    const result = await fetchBook(start + offset);
    if (['candidate', 'rights-ok-no-download-link', 'rights-not-explicit'].includes(result.status)) existingPagesFetched += 1;
    if (result.status === 'candidate') {
      rightsChecked += 1;
      downloadLinksFound += result.downloadUrls.length;
      discovered.push(result);
    } else if (result.status !== 'not-a-waqfeya-page') {
      skipped.push(result);
    }
    if (discovered.length >= batchSize) break;
  }
}

const manifest = [];
for (const book of discovered) {
  const id = `${safeName(book.title)}-${crypto.createHash('sha1').update(book.sourcePage).digest('hex').slice(0, 10)}`;
  const pdf = path.join(out, `${id}.pdf`);
  let downloadedFrom = null;
  let lastError = null;

  for (const candidateUrl of book.downloadUrls) {
    try {
      curlFile(candidateUrl, pdf);
      if (!isPdfFile(pdf)) {
        lastError = `downloaded-content-is-not-pdf:${candidateUrl}`;
        fs.rmSync(pdf, { force: true });
        continue;
      }
      downloadedFrom = candidateUrl;
      break;
    } catch (error) {
      lastError = `pdf-download-failed:${error.message}`;
      fs.rmSync(pdf, { force: true });
    }
  }

  if (!downloadedFrom) {
    skipped.push({ ...book, status: 'pdf-download-failed', reason: lastError || 'no-working-download-url' });
    continue;
  }

  const bytes = fs.statSync(pdf).size;
  manifest.push({
    id,
    title: book.title,
    source: 'Waqfeya',
    sourcePage: book.sourcePage,
    downloadUrl: downloadedFrom,
    rightsStatus: 'explicit-waqf-or-free-distribution-signal',
    rightsEvidence: book.rightsEvidence,
    bytes,
    sha256: sha256(pdf),
    proof: Boolean(book.proof)
  });
  downloaded += 1;
}

const result = {
  generatedAt: new Date().toISOString(),
  start,
  requestedBatchSize: batchSize,
  bookIdBatch,
  proofUrls,
  proofCandidates,
  existingPagesFetched,
  discoveredCandidates: discovered.length,
  rightsChecked,
  downloadLinksFound,
  downloaded,
  books: manifest,
  skipped
};

fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ existingPagesFetched, discoveredCandidates: discovered.length, rightsChecked, downloadLinksFound, downloaded }, null, 2));
process.exitCode = downloaded > 0 ? 0 : 2;
