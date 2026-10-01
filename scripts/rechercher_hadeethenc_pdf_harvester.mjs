#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'artifacts/rechercher/multilingual-deep-pdf-expansion');
const BASE = 'https://hadeethenc.com';
const LANGS = ['ar','en','ur','es','id','ug','bn','fr','tr','ru','bs','si','hi','zh','fa','vi','tl','ku','ha','pt','ml','te','sw','ta','my','th','de','ja','ps','as','sq','sv','am','nl','gu','ky','ne','yo','lt','prs','sr','so','tg','rw','ro','hu','cs','mos','mg','ff','it','om','kn','wo','bg','az','el','ak','uz','uk','ka','ln','mk','km','bm','pa','mr','da','rn','yao','kmr','ms'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const safe = s => String(s || 'unknown').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'unknown';
const sha256 = b => createHash('sha256').update(b).digest('hex');
const pdfRe = /https?:\/\/[^\s"'<>]+?\.pdf(?:[?#][^\s"'<>]*)?/gi;
async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'DinAllah-Rechercher/2.2', accept: 'text/html,application/json,application/pdf;q=0.9,*/*;q=0.1' } });
      const bytes = Buffer.from(await r.arrayBuffer());
      if (r.status === 429) { await sleep(1200 * (i + 1)); continue; }
      return { status: r.status, bytes, finalUrl: r.url };
    } catch { if (i === 2) return null; await sleep(700 * (i + 1)); }
  }
  return null;
}
function extractPdfLinks(text, base) {
  const found = new Set();
  for (const m of text.matchAll(pdfRe)) found.add(m[0].replaceAll('&amp;', '&'));
  const href = /href=["']([^"']+)["']/gi;
  for (const m of text.matchAll(href)) {
    try { const u = new URL(m[1], base); if (/\.pdf(?:[?#]|$)/i.test(u.href)) found.add(u.href); } catch {}
  }
  return [...found];
}
async function download(url, file) {
  await new Promise((resolve, reject) => {
    const p = spawn('curl', ['--fail','--silent','--show-error','--location','--proto','=https','--output',file,url], { stdio: ['ignore','ignore','pipe'] });
    let err = ''; p.stderr.on('data', x => err += x); p.on('error', reject); p.on('close', c => c === 0 ? resolve() : reject(new Error(err || 'curl failed')));
  });
}
await fs.mkdir(OUT, { recursive: true });
const manifest = { schema: 'rechercher/hadeethenc-pdf-harvest/v1', generated_at: new Date().toISOString(), languages: LANGS, total_files: 0, files: [], errors: [] };
for (const lang of LANGS) {
  const urls = [`${BASE}/${lang}/home`, `${BASE}/${lang}/browse/all`];
  const links = new Set();
  for (const pageUrl of urls) {
    const page = await get(pageUrl); if (!page) continue;
    for (const u of extractPdfLinks(page.bytes.toString('utf8'), page.finalUrl || pageUrl)) links.add(u);
  }
  for (const url of [...links]) {
    const name = safe(path.basename(new URL(url).pathname)) || `hadeethenc_${lang}.pdf`;
    const dir = path.join(OUT, lang, 'hadith', 'hadeethenc'); await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, name.endsWith('.pdf') ? name : `${name}.pdf`);
    try {
      await download(url, file); const b = await fs.readFile(file);
      if (b.subarray(0, 4).toString() !== '%PDF') { await fs.rm(file, { force: true }); continue; }
      manifest.files.push({ source: 'hadeethenc', language_iso: lang, url, path: path.relative(ROOT, file), bytes: b.length, sha256: sha256(b), acquisition: 'research-only', rights: 'review-required' });
      manifest.total_files++;
    } catch (e) { await fs.rm(file, { force: true }); manifest.errors.push({ language_iso: lang, url, error: String(e.message || e) }); }
  }
  console.log(`HADEETHENC_PROGRESS language=${lang} pdfs=${manifest.total_files}`);
}
await fs.writeFile(path.join(OUT, 'hadeethenc-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ languages: LANGS.length, total_files: manifest.total_files, errors: manifest.errors.length }));
