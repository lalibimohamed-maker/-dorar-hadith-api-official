import { mkdir, writeFile } from 'node:fs/promises';
import { DEEP_SOURCES } from '../config/rechercher-islamcontent-terminology-deep-registry-v1.js';

const timeoutMs = Number(process.env.RECHERCHER_DEEP_TIMEOUT_MS ?? 15000);
const maxPages = Number(process.env.RECHERCHER_DEEP_MAX_PAGES ?? 25);
const mode = process.argv[2] ?? 'manifest';

async function getText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: { accept: 'text/html,application/json', 'user-agent': 'DeenAllah-Rechercher/1.0' }, signal: controller.signal });
    const text = await response.text();
    return { status: response.status, ok: response.ok, url: response.url, text };
  } finally { clearTimeout(timer); }
}

function absolute(base, href) {
  try { return new URL(href, base).toString(); } catch { return null; }
}

function linksFromHtml(base, html) {
  const links = new Set();
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const url = absolute(base, match[1]);
    if (url) links.add(url);
  }
  return [...links];
}

async function probe(url) {
  try {
    const result = await getText(url);
    return { url, status: result.status, ok: result.ok, finalUrl: result.url, bytes: Buffer.byteLength(result.text) };
  } catch (error) {
    return { url, status: null, ok: false, error: error.message };
  }
}

async function discoverTerminology() {
  const source = DEEP_SOURCES.find((item) => item.id === 'terminologyenc-deep');
  const probes = [];
  const pages = [];
  for (const lang of source.languages) {
    const home = `${source.baseUrl}/${lang}/home`;
    const result = await getText(home);
    probes.push({ url: home, status: result.status, ok: result.ok, bytes: Buffer.byteLength(result.text) });
    if (!result.ok) continue;
    const links = linksFromHtml(source.baseUrl, result.text).filter((url) => url.includes(`/` + lang + `/browse/`));
    pages.push({ language: lang, home, discoveredLinks: [...new Set(links)].slice(0, 500) });
  }
  const categoryPages = new Set();
  for (const page of pages) for (const url of page.discoveredLinks) if (/\/browse\/category\//.test(url)) categoryPages.add(url);
  for (const url of [...categoryPages].slice(0, maxPages)) probes.push(await probe(url));
  return { sourceId: source.sourceId, strategy: source.kind, languagesChecked: source.languages.length, categoryPagesProbed: Math.min(categoryPages.size, maxPages), probes, pages };
}

async function discoverIslamContent() {
  const source = DEEP_SOURCES.find((item) => item.id === 'islamcontent-deep');
  const probes = [];
  const languages = ['ar', 'en', 'fr', 'ru', 'ur'];
  for (const lang of languages) {
    for (const route of [`/${lang}/categories`, `/${lang}/content?content_type=4&lang=${lang}&page=1`]) {
      probes.push(await probe(`${source.web.baseUrl}${route}`));
    }
  }
  probes.push(await probe(source.documentationUrl));
  probes.push(await probe(source.postmanCollectionUrl));
  probes.push(await probe(source.postmanEnvironmentUrl));
  return { sourceId: source.sourceId, strategy: source.kind, languagesProbed: languages, contentTypes: source.web.contentTypes, probes };
}

await mkdir('artifacts', { recursive: true });
const result = mode === 'terminology' ? await discoverTerminology() : mode === 'islamcontent' ? await discoverIslamContent() : { generatedAt: new Date().toISOString(), sources: DEEP_SOURCES };
result.generatedAt = new Date().toISOString();
await writeFile(`artifacts/rechercher-deep-${mode}.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
