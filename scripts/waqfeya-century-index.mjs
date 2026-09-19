#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const CATEGORY_URL = 'https://waqfeya.net/centuries/%D8%A7%D9%84%D9%82%D8%B1%D9%86-15-%D9%87%D9%80-426d13bd9086441e84cbb8b7ed9d3a1a';
const OUTPUT = 'data/corpus/waqfeya/century-15/index.jsonl';
const STATE = 'data/corpus/waqfeya/century-15/index-state.json';
const MAX_PAGES = Number(process.env.MAX_PAGES ?? '350');
const EXPECTED_MIN = Number(process.env.EXPECTED_MIN ?? '6000');
const USER_AGENT = 'Deen-Allah-Encyclopedia-Waqfeya-Harvester/2026';

function normalizeText(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function absUrl(href, baseUrl) {
  try {
    const url = new URL(href, baseUrl);
    if (url.protocol !== 'https:') return null;
    if (!['waqfeya.net', 'www.waqfeya.net'].includes(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function extractBookLinks(html, baseUrl) {
  const found = new Map();
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(re)) {
    const url = absUrl(match[1], baseUrl);
    if (!url) continue;
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith('/books/')) continue;
    if (parsed.pathname === '/books' || parsed.pathname === '/books/') continue;
    const title = normalizeText(html.slice(Math.max(0, match.index - 300), match.index + match[0].length + 500))
      .replace(/.*href\s*=\s*["'][^"']+["'][^>]*>/i, ' ')
      .slice(0, 400);
    const id = createHash('sha256').update(url).digest('hex').slice(0, 20);
    found.set(url, { id, sourcePage: url, titleHint: title || url });
  }
  return [...found.values()];
}

function extractDeclaredCount(html) {
  const text = normalizeText(html);
  const match = text.match(/عدد الكتب\s*[:：]?\s*([\d,٬\.\s]+)/u);
  if (!match) return null;
  const n = Number(match[1].replace(/[,٬.\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return await response.text();
}

async function tryPagination(baseUrl, parameter) {
  const discovered = new Map();
  let emptyStreak = 0;
  let firstPageSize = 0;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL(baseUrl);
    if (parameter === 'page') url.searchParams.set('page', String(page));
    else if (parameter === 'p') url.searchParams.set('p', String(page));
    else if (parameter === 'offset') url.searchParams.set('offset', String((page - 1) * Math.max(firstPageSize, 30)));
    else if (parameter === 'st') url.searchParams.set('st', String((page - 1) * Math.max(firstPageSize, 30)));

    let html;
    try {
      html = await fetchText(url.href);
    } catch (error) {
      console.warn(`pagination ${parameter} page ${page} failed: ${error.message}`);
      emptyStreak += 1;
      if (emptyStreak >= 3) break;
      continue;
    }

    const books = extractBookLinks(html, url.href);
    if (page === 1) firstPageSize = books.length;
    let added = 0;
    for (const book of books) {
      if (!discovered.has(book.sourcePage)) {
        discovered.set(book.sourcePage, book);
        added += 1;
      }
    }

    if (added === 0) emptyStreak += 1;
    else emptyStreak = 0;

    if (emptyStreak >= 2) break;
    if (discovered.size >= EXPECTED_MIN) break;
  }
  return discovered;
}

async function main() {
  const initialHtml = await fetchText(CATEGORY_URL);
  const declaredCount = extractDeclaredCount(initialHtml) ?? EXPECTED_MIN;
  const all = new Map();

  for (const book of extractBookLinks(initialHtml, CATEGORY_URL)) all.set(book.sourcePage, book);

  const initialParams = ['page', 'p', 'offset', 'st'];
  for (const parameter of initialParams) {
    if (all.size >= declaredCount) break;
    console.log(`Trying pagination parameter: ${parameter}`);
    const candidate = await tryPagination(CATEGORY_URL, parameter);
    for (const [url, book] of candidate) all.set(url, book);
    console.log(`Collected ${all.size}/${declaredCount}`);
  }

  if (all.size < EXPECTED_MIN) {
    throw new Error(`Index discovery incomplete: found ${all.size}, expected at least ${EXPECTED_MIN}. No partial index will be committed.`);
  }

  const sorted = [...all.values()].sort((a, b) => a.sourcePage.localeCompare(b.sourcePage));
  const rows = sorted.map((book, index) => JSON.stringify({
    index,
    id: book.id,
    titleHint: book.titleHint,
    sourcePage: book.sourcePage,
    sourceIndex: CATEGORY_URL,
    century: 15,
    discoveryStatus: 'discovered',
  }));

  await mkdir('data/corpus/waqfeya/century-15', { recursive: true });
  await writeFile(OUTPUT, `${rows.join('\n')}\n`, 'utf8');
  const sha256 = createHash('sha256').update(await readFile(OUTPUT)).digest('hex');
  const state = {
    sourceIndex: CATEGORY_URL,
    declaredCount,
    discoveredCount: sorted.length,
    indexSha256: sha256,
    generatedAt: new Date().toISOString(),
    policy: 'Index all books in the requested century; PDF acquisition is separately rights-gated per book page and never assumes hosting equals redistribution permission.',
  };
  await writeFile(STATE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(state, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
