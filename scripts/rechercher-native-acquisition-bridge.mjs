import { mkdir, writeFile } from 'node:fs/promises';
import { federatedSearch } from '../src/rechercher/native-federation-engine.js';

const query = process.argv.slice(2).join(' ').trim() || 'الحديث';
const OUT_DIR = 'books-batches/rechercher-native-live';
const OUT = `${OUT_DIR}/catalog.json`;

function isAllowedCreativeCommonsLicense(value) {
  try {
    const url = new URL(String(value));
    if (url.protocol !== 'https:') return false;
    const hostname = url.hostname.toLowerCase();
    return hostname === 'creativecommons.org' || hostname.endsWith('.creativecommons.org');
  } catch {
    return false;
  }
}

async function enrichInternetArchive(record) {
  if (record.sourceId !== 'internet-archive' || !record.identifier) return null;
  const response = await fetch(`https://archive.org/metadata/${encodeURIComponent(record.identifier)}`, {
    headers: { accept: 'application/json', 'user-agent': 'DeenAllah-Rechercher/1.0' },
  });
  if (!response.ok) return null;
  const metadata = await response.json();
  const rights = String(metadata?.metadata?.rights ?? '').toLowerCase();
  const license = String(metadata?.metadata?.licenseurl ?? '');
  const redistributable = rights.includes('public domain') || rights.includes('creativecommons') || isAllowedCreativeCommonsLicense(license);
  if (!redistributable) return null;
  const pdf = (metadata?.files ?? []).find((file) => /\.pdf$/i.test(String(file.name ?? '')));
  if (!pdf) return null;
  return {
    id: `native-ia:${record.identifier}`,
    title: record.title,
    author: record.author,
    expected_volumes: 1,
    rights_status: 'verified-redistributable',
    acquisition_status: 'verified-redistributable',
    sources: [{ url: `https://archive.org/download/${encodeURIComponent(record.identifier)}/${String(pdf.name).split('/').map(encodeURIComponent).join('/')}`, pdf_url: `https://archive.org/download/${encodeURIComponent(record.identifier)}/${String(pdf.name).split('/').map(encodeURIComponent).join('/')}`, label: 'Internet Archive native metadata', discover_pdfs: false }],
    native_provenance: record,
  };
}

await mkdir(OUT_DIR, { recursive: true });
const federation = await federatedSearch(query, { concurrency: 5, timeoutMs: 12000 });
const books = [];
for (const record of federation.records) {
  try {
    const book = await enrichInternetArchive(record);
    if (book) books.push(book);
  } catch (error) {
    console.log(`[NATIVE BRIDGE] skipped ${record.identifier}: ${error.message}`);
  }
}
const unique = [...new Map(books.map((book) => [book.id, book])).values()].slice(0, 12);
await writeFile(OUT, JSON.stringify({ schema: 'din-allah-encyclopedia/rechercher-native-live-catalog/v1', generated_at: new Date().toISOString(), query, books: unique }, null, 2) + '\n', 'utf8');
console.log(`[NATIVE BRIDGE] query=${query} discovered=${federation.records.length} rights-eligible-pdfs=${unique.length}`);
console.log(`[NATIVE BRIDGE] catalog=${OUT}`);