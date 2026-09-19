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

// Independently verified public-domain items surfaced by current web research.
// They are additive fallbacks so a changed upstream catalog does not make a run empty.
const verifiedPublicDomain = [
  {
    id: 'quran-mcgill-1770-0025',
    titleAr: 'القرآن الكريم — مخطوطة 1770',
    source: 'McGill University Library / Internet Archive',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Al-Qur%CA%BB%C4%81n_(IA_McGillLibrary-rbsc_isl_ms-rbd-arabic-0025-17881).pdf',
    downloadUrl: 'https://archive.org/download/McGillLibrary-rbsc_isl_ms-rbd-arabic-0025-17881/rbsc_isl_ms-rbd-arabic-0025.pdf',
    rightsBasis: 'Public Domain / Public Domain Mark; source identifies item as public domain.'
  },
  {
    id: 'quran-mcgill-18183',
    titleAr: 'القرآن الكريم — مخطوطة McGill 18183',
    source: 'McGill University Library / Internet Archive',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Al-Qur%CA%BB%C4%81n_(IA_McGillLibrary-rbsc_isl_ms-rbd-arabic-0028-18183).pdf',
    downloadUrl: 'https://archive.org/download/McGillLibrary-rbsc_isl_ms-rbd-arabic-0028-18183/McGillLibrary-rbsc_isl_ms-rbd-arabic-0028-18183.pdf',
    rightsBasis: 'Public Domain / Public Domain Mark; source identifies item as public domain.'
  },
  {
    id: 'mughni-al-labib-mcgill-18129',
    titleAr: 'مغني اللبيب عن كتب الأعاريب',
    source: 'McGill University Library / Internet Archive',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Mughn%C4%AB_al-lab%C4%ABb_%CA%BBan_kutub_al-a%CA%BB%C4%81r%C4%ABb_(IA_McGillLibrary-rbsc_islam-ms-isl-0076-18129).pdf',
    downloadUrl: 'https://archive.org/download/McGillLibrary-rbsc_islam-ms-isl-0076-18129/McGillLibrary-rbsc_islam-ms-isl-0076-18129.pdf',
    rightsBasis: 'Public Domain / Public Domain Mark; source identifies item as public domain.'
  }
];

function curl(url, output = null) {
  const args = ['-L', '--fail', '--silent', '--show-error', '--retry', '4', '--connect-timeout', '30'];
  if (output) args.push('-o', output, url); else args.push(url);
  return execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
}
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function safeName(s) { return String(s).replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 140); }

const manifest = [];
const seenUrls = new Set();
function harvest(book, sourceCatalogUrl = catalogUrl) {
  if (!book?.pdf_url || !/^https?:\/\//i.test(book.pdf_url)) return;
  if (seenUrls.has(book.pdf_url)) return;
  seenUrls.add(book.pdf_url);
  const id = `${safeName(book.id || book.title_en || book.title_ar)}-${crypto.createHash('sha1').update(book.pdf_url).digest('hex').slice(0, 10)}`;
  const file = path.join(out, `${id}.pdf`);
  try {
    curl(book.pdf_url, file);
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) return;
    manifest.push({ id, titleAr: book.title_ar, titleEn: book.title_en, authorAr: book.author_ar, authorEn: book.author_en, category: book.category, source: 'mohammed-2-5/islamic-library-data', sourceCatalogUrl, downloadUrl: book.pdf_url, rightsBasis: 'Upstream README public-domain declaration for classical Islamic texts', bytes: fs.statSync(file).size, sha256: sha256(file) });
  } catch (error) { console.error(`Skipped catalog item ${book.id}: ${error.message}`); }
}

try {
  const readme = curl(readmeUrl);
  if (!/Islamic texts.*Public domain classical texts/iu.test(readme)) throw new Error('Upstream public-domain declaration was not found; catalog harvest closed.');
  const catalog = JSON.parse(curl(catalogUrl));
  const books = Array.isArray(catalog.books) ? catalog.books : [];
  const pdfBooks = books.filter((book) => typeof book.pdf_url === 'string' && /^https?:\/\//i.test(book.pdf_url));
  for (const book of pdfBooks.slice(start, start + batchSize)) harvest(book, catalogUrl);
  console.log(JSON.stringify({ catalogBooks: books.length, pdfBooks: pdfBooks.length, start, batchSize, catalogDownloaded: manifest.length }, null, 2));
} catch (error) {
  console.error(`Catalog harvest unavailable: ${error.message}`);
}

for (const item of verifiedPublicDomain) {
  const id = `${item.id}-${crypto.createHash('sha1').update(item.downloadUrl).digest('hex').slice(0, 10)}`;
  const file = path.join(out, `${safeName(id)}.pdf`);
  if (fs.existsSync(file) && fs.statSync(file).size > 0) continue;
  try {
    curl(item.downloadUrl, file);
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) continue;
    manifest.push({ id, titleAr: item.titleAr, source: item.source, sourceUrl: item.sourceUrl, downloadUrl: item.downloadUrl, rightsBasis: item.rightsBasis, bytes: fs.statSync(file).size, sha256: sha256(file) });
  } catch (error) {
    console.error(`Skipped verified item ${item.id}: ${error.message}`);
  }
}

fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), start, batchSize, downloaded: manifest.length, books: manifest }, null, 2)}\n`);
console.log(JSON.stringify({ start, batchSize, downloaded: manifest.length, verifiedFallbacks: verifiedPublicDomain.length }, null, 2));
if (manifest.length === 0) process.exitCode = 2;
