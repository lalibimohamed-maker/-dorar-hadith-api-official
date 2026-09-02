import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';

const root = process.cwd();
const out = path.join(root, 'artifacts', 'waqfeya-books');
fs.mkdirSync(out, { recursive: true });
const batchSize = Number(process.env.WAQFEYA_BATCH_SIZE || 25);
const start = Number(process.env.WAQFEYA_START || 0);
const pages = Number(process.env.WAQFEYA_PAGES || 4);

function curl(url) {
  return execFileSync('curl', ['-L', '--fail', '--silent', '--show-error', '--retry', '3', '--connect-timeout', '20', url], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
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

const candidates = new Map();
for (let i = 0; i < pages; i += 1) {
  const offset = start + i * 50;
  const url = `https://waqfeya.net/top.php?st=${offset}`;
  let html = '';
  try { html = curl(url); } catch { continue; }
  const links = [...html.matchAll(/href=["']([^"']+)["'][^>]*>([^<]*)</gi)];
  for (const match of links) {
    const href = absolute(url, match[1]);
    const title = match[2].replace(/\s+/g, ' ').trim();
    if (!href || !href.includes('/books/') || !title) continue;
    candidates.set(href, title);
  }
}

const chosen = [...candidates.entries()].slice(0, batchSize);
const manifest = [];
let downloaded = 0;

for (const [bookUrl, title] of chosen) {
  let page = '';
  try { page = curl(bookUrl); } catch { continue; }

  // Rights gate: explicit waqf/free wording only.
  const rightsMatch = page.match(/(وقف\s+لله(?:\s+تعالى)?|وقف\s+لله\s+تعالى|وقف\s+على\s+طلبة\s+العلم|متاح\s+للتوزيع\s+بحرية|توزيع\s+حر)/u);
  if (!rightsMatch) continue;

  const hrefs = [...page.matchAll(/href=["']([^"']+)["']/gi)].map((m) => absolute(bookUrl, m[1])).filter(Boolean);
  const pdfUrl = hrefs.find((u) => /\.pdf(?:$|\?)/i.test(u)) || hrefs.find((u) => /archive\.org\/download\//i.test(u) && /pdf/i.test(u));
  if (!pdfUrl) continue;

  const id = `${safeName(title)}-${crypto.createHash('sha1').update(bookUrl).digest('hex').slice(0, 10)}`;
  const pdf = path.join(out, `${id}.pdf`);
  try {
    execFileSync('curl', ['-L', '--fail', '--silent', '--show-error', '--retry', '3', '--connect-timeout', '30', pdfUrl, '-o', pdf], { stdio: 'inherit' });
  } catch { continue; }
  if (!fs.existsSync(pdf) || fs.statSync(pdf).size === 0) continue;

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

fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), start, pages, requestedBatchSize: batchSize, discoveredCandidates: candidates.size, downloaded, books: manifest }, null, 2)}\n`);
console.log(JSON.stringify({ discoveredCandidates: candidates.size, downloaded }, null, 2));
if (downloaded === 0) process.exitCode = 2;
