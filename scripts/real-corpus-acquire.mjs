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
fs.mkdirSync(path.join(root, 'data/corpus/hadith/collections'), { recursive: true });

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function download(url, out) {
  execFileSync('curl', ['-L', '--fail', '--silent', '--show-error', '--retry', '4', '--connect-timeout', '30', url, '-o', out], { stdio: 'inherit' });
}
function writeIfChanged(file, content) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}

const acquired = [];

// Quran text: Tanzil permits verbatim redistribution with attribution and source link.
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

// Open Hadith Data release: structured data is CC0; English translations are not copied.
const h = manifest.sources.openHadithData;
const apiUrl = 'https://api.github.com/repos/Jaguar16/open-hadith-data/releases/tags/v1.1.0';
const releaseJson = path.join(tmp, 'release.json');
download(apiUrl, releaseJson);
const release = JSON.parse(fs.readFileSync(releaseJson, 'utf8'));
const asset = release.assets?.find((a) => a.name === 'collections-json.zip');
if (!asset?.browser_download_url) throw new Error('collections-json.zip release asset not found');
const zip = path.join(tmp, 'collections-json.zip');
download(asset.browser_download_url, zip);
const extractDir = path.join(tmp, 'hadith');
fs.mkdirSync(extractDir, { recursive: true });
execFileSync('unzip', ['-q', '-o', zip, '-d', extractDir], { stdio: 'inherit' });

const aliases = {
  'bukhari': ['bukhari', 'sahih-al-bukhari', 'sahih-bukhari'],
  'muslim': ['muslim', 'sahih-muslim'],
  'abu-dawud': ['abu-dawud', 'abudawud', 'abu-daud'],
  'tirmidhi': ['tirmidhi', 'jami-at-tirmidhi', 'jami-tirmidhi'],
  'nasai': ['nasai', 'nasa-i', 'sunan-an-nasai', 'sunan-nasai'],
  'ibn-majah': ['ibn-majah', 'ibnmajah'],
  'malik': ['malik', 'muwatta'],
  'ahmad': ['ahmad', 'musnad-ahmad'],
  'darimi': ['darimi', 'sunan-ad-darimi', 'sunan-darimi'],
  'adab-al-mufrad': ['adab-al-mufrad', 'adabalmufrad'],
  'riyad-as-salihin': ['riyad-as-salihin', 'riyad-assalihin'],
  'bulugh-al-maram': ['bulugh-al-maram', 'bulugh-almaram'],
  'shamail': ['shamail', 'ash-shamail', 'shama-il'],
  'mishkat-al-masabih': ['mishkat-al-masabih', 'mishkat-almasabih']
};
const wanted = h.collections;
const normalizedName = (value) => String(value).toLowerCase().replace(/\.json$/, '').replace(/[^a-z0-9]+/g, '-');
const inputFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.json')) inputFiles.push(full);
  }
}
walk(extractDir);

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

const selected = [];
const missing = [];
for (const wantedId of wanted) {
  const names = aliases[wantedId] ?? [wantedId];
  const match = inputFiles.find((file) => {
    const base = normalizedName(path.basename(file));
    return names.some((alias) => base === alias || base.startsWith(`${alias}-`) || base.endsWith(`-${alias}`));
  });
  if (!match) {
    missing.push(wantedId);
    continue;
  }
  const out = path.join(root, 'data/corpus/hadith/collections', `${wantedId}.json`);
  const data = stripEnglish(JSON.parse(fs.readFileSync(match, 'utf8')));
  writeIfChanged(out, `${JSON.stringify(data, null, 2)}\n`);
  selected.push({
    id: wantedId,
    sourceFile: path.basename(match),
    artifact: `data/corpus/hadith/collections/${wantedId}.json`,
    sha256: sha256(out),
    bytes: fs.statSync(out).size
  });
}
if (selected.length < 6) throw new Error(`Hadith acquisition found only ${selected.length} target collections; missing: ${missing.join(', ')}`);

const catalogOut = path.join(root, 'data/corpus/hadith/catalog-2026.json');
writeIfChanged(catalogOut, `${JSON.stringify({ source: h.source, license: h.license, retrievedAt: stamp, collections: selected, missing }, null, 2)}\n`);
acquired.push({
  id: 'hadith-core-arabic',
  kind: h.kind,
  artifact: 'data/corpus/hadith/collections/',
  catalog: 'data/corpus/hadith/catalog-2026.json',
  source: h.source,
  license: h.license,
  collections: selected.map((x) => x.id),
  missingCollections: missing,
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
