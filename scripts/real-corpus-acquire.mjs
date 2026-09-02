import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config/real-corpus-acquisition-2026.json'), 'utf8'));
const stamp = new Date().toISOString();
const tmp = fs.mkdtempSync(path.join('/tmp/', 'deen-allah-corpus-'));
const statePath = path.join(root, 'data/corpus/acquisition-state-2026.json');

fs.mkdirSync(path.join(root, 'data/corpus/quran'), { recursive: true });
fs.mkdirSync(path.join(root, 'data/corpus/hadith'), { recursive: true });

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function download(url, out) {
  execFileSync('curl', ['-L', '--fail', '--silent', '--show-error', '--retry', '3', '--connect-timeout', '30', url, '-o', out], { stdio: 'inherit' });
}
function writeIfChanged(file, content) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return false;
  fs.writeFileSync(file, content);
  return true;
}

const acquired = [];

// Quran: Tanzil explicitly permits verbatim redistribution with attribution/link.
const q = manifest.sources.quranTanzil;
const qTmp = path.join(tmp, 'quran-uthmani.txt');
download(q.sourceMirror, qTmp);
const qText = fs.readFileSync(qTmp, 'utf8').replace(/^\uFEFF/, '');
const qHeader = [
  'Tanzil Quran Text',
  'Copyright (C) 2007-2021 Tanzil Project',
  'License: Creative Commons Attribution 3.0',
  'Source: https://tanzil.net/',
  'Terms: verbatim redistribution permitted; changing the Quran text is not allowed.',
  ''
].join('\n');
const qOut = path.join(root, q.artifact);
writeIfChanged(qOut, `${qHeader}${qText.endsWith('\n') ? qText : `${qText}\n`}`);
acquired.push({
  id: 'quran-uthmani',
  kind: q.kind,
  artifact: q.artifact,
  source: q.source,
  sourceMirror: q.sourceMirror,
  license: q.license,
  sha256: sha256(qOut),
  bytes: fs.statSync(qOut).size,
  retrievedAt: stamp
});

// Hadith: the repository explicitly dedicates its structured data to CC0.
const h = manifest.sources.openHadithData;
const apiUrl = 'https://api.github.com/repos/Jaguar16/open-hadith-data/releases/tags/v1.1.0';
const releaseJson = path.join(tmp, 'release.json');
download(apiUrl, releaseJson);
const release = JSON.parse(fs.readFileSync(releaseJson, 'utf8'));
const asset = release.assets?.find((a) => a.name === 'collections-json.zip');
if (!asset?.browser_download_url) throw new Error('collections-json.zip release asset not found');
const zip = path.join(tmp, 'collections-json.zip');
download(asset.browser_download_url, zip);
execFileSync('unzip', ['-q', '-o', zip, '-d', path.join(tmp, 'hadith')], { stdio: 'inherit' });

const wanted = new Set(h.collections);
const inputFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.json')) inputFiles.push(full);
  }
}
walk(path.join(tmp, 'hadith'));

const collections = [];
for (const file of inputFiles) {
  let value;
  try { value = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
  const id = String(value?.id ?? value?.collection_id ?? value?.collection ?? value?.name_en ?? '').toLowerCase();
  const normalized = id.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const hit = [...wanted].find((x) => normalized === x || normalized.includes(x));
  if (!hit) continue;
  collections.push({ id: hit, data: value });
}
if (collections.length < 6) throw new Error(`Hadith acquisition found only ${collections.length} target collections`);

const stripEnglish = (v) => {
  if (Array.isArray(v)) return v.map(stripEnglish);
  if (!v || typeof v !== 'object') return v;
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (/^(text|matn|isnad|grade)_en$/.test(k)) continue;
    out[k] = stripEnglish(val);
  }
  return out;
};
const hadithOut = path.join(root, h.artifact);
const hadithDoc = {
  source: h.source,
  license: h.license,
  note: 'Arabic structured hadith data materialized from the CC0 structured-data portion; English translation fields are intentionally omitted.',
  retrievedAt: stamp,
  collections: collections.map(({ id, data }) => ({ id, data: stripEnglish(data) }))
};
writeIfChanged(hadithOut, `${JSON.stringify(hadithDoc, null, 2)}\n`);
acquired.push({
  id: 'hadith-core-arabic',
  kind: h.kind,
  artifact: h.artifact,
  source: h.source,
  license: h.license,
  collections: collections.map((x) => x.id),
  sha256: sha256(hadithOut),
  bytes: fs.statSync(hadithOut).size,
  retrievedAt: stamp
});

const state = {
  version: manifest.version,
  generatedAt: stamp,
  policy: manifest.policy,
  acquired
};
writeIfChanged(statePath, `${JSON.stringify(state, null, 2)}\n`);
console.log(JSON.stringify(state, null, 2));
