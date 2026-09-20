#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'artifacts/rechercher/multilingual-deep-pdf-expansion');
const BASE = 'https://quranenc.com';
const LANGS = ['ar','en','fr','de','es','pt','it','nl','tr','bs','id','tl','sq','bn','ur','fa','vi','zh','ja','ug','hi','si','as','ta','te','ps','ml','ha','ku','nqo','km','uz','ne','rw','ff','az','th','gu','am','lt','kn','da','ka','my','prs','mk','pl','mos','pa','ak','ky','ln','ny','so','sw','om','uk','sv','kbd','sn','sr','tg','aa','hr','ko','lo','mr','yao','yo','ber','bg','ca','cs','cy','el','eo','et','eu','fi','fil','ga','gl','he','hu','hy','is','jv','kk','la','lv','mg','mn','ms','mt','no','or','ro','ru','sk','sl','sm','st','su','tgl','ti','tk','tt','xh','yi','zu','af','be','ceb','co','fy','gd','haw','hmn','ht','ig','jw','lb','mi','nya','sd','smo','snd','stq','sun','tat','xho','zul','ch'];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const safe = value => String(value || 'unknown').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'unknown';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const pdfRe = /https?:\/\/[^\s"'<>]+?\.pdf(?:[?#][^\s"'<>]*)?/gi;

async function get(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'DinAllah-Rechercher/2.2', accept: 'text/html,application/json,application/pdf;q=0.9,*/*;q=0.1' } });
      const bytes = Buffer.from(await response.arrayBuffer());
      if (response.status === 429) { await sleep(1500 * (attempt + 1)); continue; }
      return { status: response.status, bytes, finalUrl: response.url };
    } catch { if (attempt === 3) return null; await sleep(800 * (attempt + 1)); }
  }
  return null;
}

function extractPdfLinks(text, base) {
  const found = new Set();
  for (const match of text.matchAll(pdfRe)) found.add(match[0].replaceAll('&amp;', '&'));
  const href = /(?:href|data-href|data-url)=["']([^"']+)["']/gi;
  for (const match of text.matchAll(href)) {
    try { const url = new URL(match[1], base); if (/\.pdf(?:[?#]|$)/i.test(url.href)) found.add(url.href); } catch {}
  }
  return [...found];
}

async function download(url, destination) {
  await new Promise((resolve, reject) => {
    const child = spawn('curl', ['--fail','--silent','--show-error','--location','--proto','=https','--output',destination,url], { stdio: ['ignore','ignore','pipe'] });
    let error = ''; child.stderr.on('data', chunk => { error += chunk; });
    child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(error || `curl exited ${code}`)));
  });
}

await fs.mkdir(OUT, { recursive: true });
const manifest = { schema: 'rechercher/quranenc-pdf-harvest/v2', generated_at: new Date().toISOString(), languages: LANGS, api: `${BASE}/api/v1/translations/list`, total_files: 0, files: [], translation_records: [], errors: [] };

for (const lang of LANGS) {
  const translationApi = `${BASE}/api/v1/translations/list/${lang}/?localization=${lang}`;
  const apiResult = await get(translationApi);
  if (apiResult?.status === 200) {
    try {
      const records = JSON.parse(apiResult.bytes.toString('utf8'));
      const list = Array.isArray(records) ? records : (Array.isArray(records?.data) ? records.data : []);
      for (const record of list) manifest.translation_records.push({ language_iso: lang, key: record.key, version: record.version, last_update: record.last_update, title: record.title, description: record.description });
    } catch (error) { manifest.errors.push({ language_iso: lang, stage: 'translation-list-parse', error: String(error.message || error) }); }
  } else if (apiResult) manifest.errors.push({ language_iso: lang, stage: 'translation-list', status: apiResult.status });

  const pageUrls = [`${BASE}/${lang}/home?pdf=1`, `${BASE}/${lang}/home`, `${BASE}/${lang}/browse/all`];
  const links = new Set();
  for (const pageUrl of pageUrls) {
    const page = await get(pageUrl);
    if (!page || page.status >= 400) continue;
    for (const url of extractPdfLinks(page.bytes.toString('utf8'), page.finalUrl || pageUrl)) links.add(url);
  }

  for (const url of links) {
    const filename = safe(path.basename(new URL(url).pathname)) || `quranenc_${lang}.pdf`;
    const directory = path.join(OUT, lang, 'quran', 'quranenc');
    await fs.mkdir(directory, { recursive: true });
    const destination = path.join(directory, filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
    try {
      await download(url, destination);
      const bytes = await fs.readFile(destination);
      if (bytes.subarray(0, 4).toString() !== '%PDF') { await fs.rm(destination, { force: true }); continue; }
      manifest.files.push({ source: 'quranenc', language_iso: lang, url, path: path.relative(ROOT, destination), bytes: bytes.length, sha256: sha256(bytes), acquisition: 'research-only', rights: 'review-required', content_policy: 'preserve-verbatim', publisher_attribution: 'QuranEnc.com' });
      manifest.total_files++;
    } catch (error) {
      await fs.rm(destination, { force: true });
      manifest.errors.push({ language_iso: lang, url, stage: 'pdf-download', error: String(error.message || error) });
    }
  }
  console.log(`QURANENC_PROGRESS language=${lang} pdfs=${manifest.total_files}`);
}

await fs.writeFile(path.join(OUT, 'quranenc-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ languages: LANGS.length, total_files: manifest.total_files, translation_records: manifest.translation_records.length, errors: manifest.errors.length }));
