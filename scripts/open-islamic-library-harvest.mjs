import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const out = path.join(root, 'artifacts', 'open-islamic-library');
fs.mkdirSync(out, { recursive: true });
const catalogUrl = 'https://raw.githubusercontent.com/mohammed-2-5/islamic-library-data/master/data/catalog.json';
const readmeUrl = 'https://raw.githubusercontent.com/mohammed-2-5/islamic-library-data/master/README.md';
const start = Math.max(0, Number(process.env.OPEN_LIBRARY_START || 0));
const batchSize = Math.max(1, Number(process.env.OPEN_LIBRARY_BATCH_SIZE || 10));
function curl(url, output = null) {
  const args = ['-L', '--fail', '--silent', '--show-error', '--retry', '4', '--connect-timeout', '30'];
  if (output) args.push('-o', output, url); else args.push(url);
  return execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
}
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function safeName(s) { return String(s).replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 140); }
const readme = curl(readmeUrl);
if (!/Islamic texts.*Public domain classical texts/iu.test(readme)) throw new Error('Upstream public-domain declaration was not found; fail closed.');
const catalog = JSON.parse(curl(catalogUrl));
const books = Array.isArray(catalog.books) ? catalog.books : [];
const pdfBooks = books.filter((book) => typeof book.pdf_url === 'string' && /^https?:\/\//i.test(book.pdf_url));
const chosen = pdfBooks.slice(start, start + batchSize);
const manifest = [];
for (const book of chosen) {
  const id = `${safeName(book.id || book.title_en || book.title_ar)}-${crypto.createHash('sha1').update(book.pdf_url).digest('hex').slice(0, 10)}`;
  const file = path.join(out, `${id}.pdf`);
  try {
    curl(book.pdf_url, file);
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) continue;
    manifest.push({ id, titleAr: book.title_ar, titleEn: book.title_en, authorAr: book.author_ar, authorEn: book.author_en, category: book.category, source: 'mohammed-2-5/islamic-library-data', sourceCatalogUrl: catalogUrl, downloadUrl: book.pdf_url, rightsBasis: 'upstream README public-domain declaration for classical Islamic texts', bytes: fs.statSync(file).size, sha256: sha256(file) });
  } catch (error) { console.error(`Skipped ${book.id}: ${error.message}`); }
}
fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), catalogBooks: books.length, pdfBooks: pdfBooks.length, start, batchSize, downloaded: manifest.length, books: manifest }, null, 2)}\n`);
console.log(JSON.stringify({ catalogBooks: books.length, pdfBooks: pdfBooks.length, start, batchSize, downloaded: manifest.length }, null, 2));
if (manifest.length === 0 && chosen.length > 0) process.exitCode = 2;
