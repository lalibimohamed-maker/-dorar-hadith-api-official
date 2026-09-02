import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';

const root = process.cwd();
const out = path.join(root, 'artifacts', 'waqfeya-books');
fs.mkdirSync(out, { recursive: true });
const batchSize = Number(process.env.WAQFEYA_BATCH_SIZE || 25);
const start = Number(process.env.WAQFEYA_START || 0);
const pages = Number(process.env.WAQFEYA_PAGES || 8);

function curl(url, output = null) {
  const args = ['-L', '--fail', '--silent', '--show-error', '--retry', '4', '--connect-timeout', '30', '-A', 'Mozilla/5.0 (compatible; DeenAllahEncyclopedia/2026; +https://github.com/lalibimohamed-maker/-dorar-hadith-api-official)'];
  if (output) args.push('-o', output, url);
  else args.push(url);
  return execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
}
function safeName(s) {
  return String(s).replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 140);
}
function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function absolute(base, href) {
  try { return new URL(href, base).href; } catch { return null; }
}
function decodeTitle(url) {
  try {
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() || 'waqfeya-book';
    return decodeURIComponent(slug).replace(/-[a-f0-9]{32}$/i, '').replace(/-/g, ' ').trim();
  } catch { return 'waqfeya-book'; }
}
function collectBookLinks(html, base) {
  const found = new Map();
  const patterns = [
    /href=["']([^"']*\/books\/[^"']+)["'][^>]*>([^<]*)</gi,
    /["'](https?:\/\/waqfeya\.net\/books\/[^"']+)["']/gi,
    /["'](\/books\/[^"']+)["']/gi
  ];
  for (const re of patterns) {
    for (const m of html.matchAll(re)) {
      const href = absolute(base, m[1]);
      if (!href || !href.includes('/books/')) continue;
      const title = (m[2] || decodeTitle(href)).replace(/\\s+/g, ' ').trim();
      found.set(href, title || decodeTitle(href));
    }
  }
  return found;
}

const candidates = new Map();
const listingUrls = new Set([
  'https://waqfeya.net/latest.php',
  'https://waqfeya.net/top.php',
  'https://waqfeya.net/'
]);
for (let i = 0; i < pages; i += 1) {
  const offset = start + i * 50;
  listingUrls.add(`https://waqfeya.net/top.php?st=${offset}`);
  listingUrls.add(`https://waqfeya.net/latest.php?st=${offset}`);
}
for (const url of listingUrls) {
  let html = '';
  try { html = curl(url); } catch { continue; }
  for (const [href, title] of collectBookLinks(html, url)) candidates.set(href, title);
}

const chosen = [...candidates.entries()].slice(0, batchSize);
const manifest = [];
let downloaded = 0;
let rightsChecked = 0;
let pdfLinksFound = 0;
const skipped = [];

for (const [bookUrl, title] of chosen) {
  let page = '';
  try { page = curl(bookUrl); } catch (error) { skipped.push({ bookUrl, reason: `book-page-fetch:${error.message}` }); continue; }

  // Waqfeya's explicit wording is evidence for the acquisition campaign; never infer permission from a download button alone.
  const rightsMatch = page.match(/(وقف\s+لله(?:\s+تعالى)?|وقف\s+على\s+طلبة\s+العلم|متاح\s+للتوزيع\s+بحرية|توزيع\s+حر)/u);
  if (!rightsMatch) { skipped.push({ bookUrl, title, reason: 'no-explicit-waqf-or-free-distribution-wording' }); continue; }
  rightsChecked += 1;

  const hrefs = [];
  for (const m of page.matchAll(/(?:href|url|downloadUrl|download_url)=["']([^"']+)["']/gi)) hrefs.push(absolute(bookUrl, m[1]));
  for (const m of page.matchAll(/["'](https?:\/\/archive\.org\/(?:download|details)\/[^"']+)["']/gi)) hrefs.push(m[1]);
  const pdfUrl = hrefs.filter(Boolean).find((u) => /\.pdf(?:$|[?#])/i.test(u))
    || hrefs.filter(Boolean).find((u) => /archive\.org\/download\//i.test(u) && /(?:pdf|file)/i.test(u));
  if (!pdfUrl) { skipped.push({ bookUrl, title, reason: 'no-pdf-download-link' }); continue; }
  pdfLinksFound += 1;

  const id = `${safeName(title)}-${crypto.createHash('sha1').update(bookUrl).digest('hex').slice(0, 10)}`;
  const pdf = path.join(out, `${id}.pdf`);
  try {
    curl(pdfUrl, pdf);
  } catch (error) { skipped.push({ bookUrl, title, pdfUrl, reason: `pdf-download:${error.message}` }); continue; }
  if (!fs.existsSync(pdf) || fs.statSync(pdf).size === 0) { skipped.push({ bookUrl, title, pdfUrl, reason: 'empty-download' }); continue; }

  manifest.push({
    id,
    title,
    source: 'Waqfeya',
    sourcePage: bookUrl,
    downloadUrl: pdfUrl,
    rightsStatus: 'waqf-explicit',
    rightsEvidence: rightsMatch[1],
    bytes: fs.statSync(pdf).size,
    sha256: sha256(pdf)
  });
  downloaded += 1;
}

const result = { generatedAt: new Date().toISOString(), start, pages, requestedBatchSize: batchSize, discoveredCandidates: candidates.size, selected: chosen.length, rightsChecked, pdfLinksFound, downloaded, books: manifest, skipped };
fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ discoveredCandidates: candidates.size, selected: chosen.length, rightsChecked, pdfLinksFound, downloaded }, null, 2));
if (downloaded === 0) process.exitCode = 2;
