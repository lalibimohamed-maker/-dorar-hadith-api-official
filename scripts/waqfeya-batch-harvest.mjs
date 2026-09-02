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

function curl(url, output = null) {
  const args = ['-L', '--fail', '--silent', '--show-error', '--retry', '4', '--connect-timeout', '30', '-A', 'Mozilla/5.0 (compatible; DeenAllahEncyclopedia/2026; +https://github.com/lalibimohamed-maker/-dorar-hadith-api-official)'];
  if (output) args.push('-o', output, url);
  else args.push(url);
  return execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
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

function titleFromHtml(html, fallback) {
  const patterns = [
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const text = m[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/\s+/g, ' ').trim();
      if (text) return text.replace(/\s*[-|–—]\s*المكتبة الوقفية.*$/u, '').trim();
    }
  }
  return fallback;
}

function extractPdfUrls(html, base) {
  const urls = new Set();
  const add = (value) => {
    if (!value) return;
    const normalized = String(value).replaceAll('\\/', '/').replaceAll('&amp;', '&');
    const resolved = absolute(base, normalized);
    if (resolved) urls.add(resolved);
  };

  for (const m of html.matchAll(/(?:href|src|url|downloadUrl|download_url|file)=["']([^"']+)["']/gi)) add(m[1]);
  for (const m of html.matchAll(/["'](https?:\/\/archive\.org\/(?:download|details)\/[^"']+)["']/gi)) add(m[1]);

  return [...urls].filter((u) => /\.pdf(?:$|[?#])/i.test(u));
}

async function fetchBook(bookId) {
  const legacy = `https://waqfeya.net/book.php?bid=${bookId}`;
  let html;
  try { html = curl(legacy); } catch (error) {
    return { bookId, status: 'unavailable', reason: `book-fetch:${error.message}` };
  }

  if (!/المكتبة الوقفية|waqfeya/i.test(html)) {
    return { bookId, status: 'not-a-waqfeya-page' };
  }

  const canonical = (html.match(/https:\/\/waqfeya\.net\/books\/[^"'\\s<]+/i) || [])[0] || legacy;
  const fallbackTitle = `Waqfeya book ${bookId}`;
  const title = titleFromHtml(html, fallbackTitle);

  const rights = html.match(/(وقف\s+لله(?:\s+تعالى)?|وقف\s+على\s+طلبة\s+العلم|متاح\s+للتوزيع\s+بحرية|توزيع\s+حر)/u);
  if (!rights) return { bookId, status: 'rights-not-explicit', title, sourcePage: canonical };

  const pdfUrls = extractPdfUrls(html, canonical);
  if (!pdfUrls.length) {
    return { bookId, status: 'rights-ok-no-pdf-link', title, sourcePage: canonical, rightsEvidence: rights[1] };
  }

  return { bookId, status: 'candidate', title, sourcePage: canonical, rightsEvidence: rights[1], pdfUrls };
}

const discovered = [];
const skipped = [];
let existingPagesFetched = 0;
let rightsChecked = 0;
let pdfLinksFound = 0;
let downloaded = 0;

for (let offset = 0; offset < bookIdBatch; offset += 1) {
  const result = await fetchBook(start + offset);
  if (['candidate', 'rights-ok-no-pdf-link', 'rights-not-explicit'].includes(result.status)) existingPagesFetched += 1;
  if (result.status === 'candidate') {
    rightsChecked += 1;
    pdfLinksFound += result.pdfUrls.length;
    discovered.push(result);
  } else if (result.status !== 'not-a-waqfeya-page') {
    skipped.push(result);
  }
  if (discovered.length >= batchSize) break;
}

const manifest = [];
for (const book of discovered) {
  const pdfUrl = book.pdfUrls.find((u) => /\.pdf(?:$|[?#])/i.test(u));
  if (!pdfUrl) continue;

  const id = `${safeName(book.title)}-${crypto.createHash('sha1').update(book.sourcePage).digest('hex').slice(0, 10)}`;
  const pdf = path.join(out, `${id}.pdf`);
  try {
    curl(pdfUrl, pdf);
  } catch (error) {
    skipped.push({ ...book, status: 'pdf-download-failed', reason: error.message, pdfUrl });
    continue;
  }

  if (!fs.existsSync(pdf) || fs.statSync(pdf).size === 0) {
    skipped.push({ ...book, status: 'empty-download', pdfUrl });
    continue;
  }

  const bytes = fs.statSync(pdf).size;
  manifest.push({
    id,
    title: book.title,
    source: 'Waqfeya',
    sourcePage: book.sourcePage,
    downloadUrl: pdfUrl,
    rightsStatus: 'waqf-explicit',
    rightsEvidence: book.rightsEvidence,
    bytes,
    sha256: sha256(pdf)
  });
  downloaded += 1;
}

const result = {
  generatedAt: new Date().toISOString(),
  start,
  requestedBatchSize: batchSize,
  bookIdBatch,
  existingPagesFetched,
  discoveredCandidates: discovered.length,
  rightsChecked,
  pdfLinksFound,
  downloaded,
  books: manifest,
  skipped
};

fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ existingPagesFetched, discoveredCandidates: discovered.length, rightsChecked, pdfLinksFound, downloaded }, null, 2));

// A zero-download scan is diagnostic, not a workflow failure. This keeps the crawler moving to the next ID range.
process.exitCode = 0;
