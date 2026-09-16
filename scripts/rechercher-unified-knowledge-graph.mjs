import { mkdir, writeFile } from 'node:fs/promises';
import { createGraph, addNode, addEdge, snapshotGraph, validateRuntimeGraph } from '../src/deen-graph-runtime.js';
import DEEP_SOURCES from '../config/rechercher-islamcontent-terminology-deep-registry-v1.js';
import { VERIFIED_MULTILINGUAL_CONNECTORS } from '../config/rechercher-verified-multilingual-connectors.js';

const UA = 'Rechercher-Unified-Knowledge-Graph/1.0';
const args = new Set(process.argv.slice(2));
const has = (name) => args.has(`--${name}`);
const maxCategories = Number(process.env.RECHERCHER_GRAPH_MAX_CATEGORIES || 24);
const maxTerms = Number(process.env.RECHERCHER_GRAPH_MAX_TERMS || 120);
const output = process.env.RECHERCHER_GRAPH_OUTPUT || 'artifacts/rechercher/unified-knowledge-graph.json';

const slug = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '-').replace(/^-|-$/g, '').slice(0, 180);
const id = (type, source, key) => `${type}:${source}:${slug(key)}`;
const provenance = (sourceId, citation, verificationState = 'source_verified') => ({ sourceId, citation, verificationState, retrievedBy: 'rechercher-unified-knowledge-graph' });
const edge = (from, to, type, sourceId, citation) => ({ id: `edge:${sourceId}:${slug(`${from}|${to}|${type}`)}`, from, to, type, provenance: provenance(sourceId, citation) });

function addSourceNode(graph, sourceId, title, url, kind = 'knowledge_source') {
  const nodeId = id(kind, sourceId, sourceId);
  if (!graph.nodes.has(nodeId)) addNode(graph, { id: nodeId, type: kind, label: title, sourceId, provenance: provenance(sourceId, url), metadata: { url } });
  return nodeId;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/json' }, redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return { url: response.url, text: await response.text(), contentType: response.headers.get('content-type') || '' };
}

function htmlLinks(html, baseUrl) {
  const links = [];
  const re = /href=["']([^"']+)["']/gi;
  for (const match of html.matchAll(re)) {
    try { links.push(new URL(match[1], baseUrl).href); } catch {}
  }
  return [...new Set(links)];
}

function titleFromHtml(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : null;
}

function addRecord(graph, sourceId, parentNode, key, label, url, metadata = {}) {
  const recordNode = id('source_record', sourceId, key);
  if (!graph.nodes.has(recordNode)) addNode(graph, { id: recordNode, type: 'source_record', label, sourceId, externalId: key, provenance: provenance(sourceId, url), metadata });
  const edgeId = edge(parentNode, recordNode, 'provides', sourceId, url);
  if (!graph.edges.has(edgeId.id)) addEdge(graph, edgeId);
  return recordNode;
}

async function addTerminology(graph) {
  const source = DEEP_SOURCES.find((item) => item.id === 'terminologyenc-deep');
  const sourceNode = addSourceNode(graph, 'terminologyenc', 'TerminologyEnc', source.baseUrl);
  const languages = source.languages;
  for (const lang of languages) {
    const langNode = id('language', 'terminologyenc', lang);
    if (!graph.nodes.has(langNode)) addNode(graph, { id: langNode, type: 'language', label: lang, language: lang, provenance: provenance('terminologyenc', `${source.baseUrl}/${lang}/home`) });
    const e = edge(sourceNode, langNode, 'supports_language', 'terminologyenc', `${source.baseUrl}/${lang}/home`);
    if (!graph.edges.has(e.id)) addEdge(graph, e);
  }
  const seenCategories = new Set();
  const seenTerms = new Set();
  for (const lang of languages.slice(0, Number(process.env.RECHERCHER_GRAPH_LANG_LIMIT || languages.length))) {
    const home = await fetchText(`${source.baseUrl}/${lang}/home`);
    for (const url of htmlLinks(home.text, home.url)) {
      const match = url.match(new RegExp(`/${lang}/browse/category/(\\d+)`));
      if (!match || seenCategories.size >= maxCategories) continue;
      const categoryKey = match[1];
      if (seenCategories.has(categoryKey)) continue;
      seenCategories.add(categoryKey);
      const categoryPage = await fetchText(url).catch(() => null);
      if (!categoryPage) continue;
      const categoryNode = id('category', 'terminologyenc', categoryKey);
      addNode(graph, { id: categoryNode, type: 'category', label: titleFromHtml(categoryPage.text) || `category-${categoryKey}`, sourceId: 'terminologyenc', externalId: categoryKey, language: lang, provenance: provenance('terminologyenc', url), metadata: { route: source.web.categoryRoute } });
      const categoryEdge = edge(sourceNode, categoryNode, 'has_category', 'terminologyenc', url);
      if (!graph.edges.has(categoryEdge.id)) addEdge(graph, categoryEdge);
      for (const termUrl of htmlLinks(categoryPage.text, categoryPage.url)) {
        const termMatch = termUrl.match(new RegExp(`/${lang}/browse/term/(\\d+)`));
        if (!termMatch || seenTerms.size >= maxTerms) continue;
        const termKey = termMatch[1];
        if (seenTerms.has(termKey)) continue;
        seenTerms.add(termKey);
        const termPage = await fetchText(termUrl).catch(() => null);
        if (!termPage) continue;
        const termNode = id('term', 'terminologyenc', termKey);
        addNode(graph, { id: termNode, type: 'term', label: titleFromHtml(termPage.text) || `term-${termKey}`, sourceId: 'terminologyenc', externalId: termKey, language: lang, provenance: provenance('terminologyenc', termUrl), metadata: { categoryId: categoryKey } });
        const termEdge = edge(categoryNode, termNode, 'has_term', 'terminologyenc', termUrl);
        if (!graph.edges.has(termEdge.id)) addEdge(graph, termEdge);
        const discovered = edge(termNode, sourceNode, 'discovered_from', 'terminologyenc', termUrl);
        if (!graph.edges.has(discovered.id)) addEdge(graph, discovered);
      }
    }
  }
  return { categories: seenCategories.size, terms: seenTerms.size };
}

async function addQuranGraph(graph) {
  const connector = VERIFIED_MULTILINGUAL_CONNECTORS.find((item) => item.id === 'quranenc');
  const sourceNode = addSourceNode(graph, 'quranenc', connector.name, connector.connector.searchUrl);
  const url = connector.connector.searchUrl;
  try {
    const data = await fetchJson(url);
    const rows = Array.isArray(data) ? data : [];
    for (const row of rows) {
      const key = row.key ?? row.id ?? row.language_iso_code;
      if (!key) continue;
      const translation = id('translation', 'quranenc', key);
      addNode(graph, { id: translation, type: 'translation', label: row.title ?? row.description ?? String(key), sourceId: 'quranenc', externalId: String(key), language: row.language_iso_code ?? null, provenance: provenance('quranenc', url), metadata: { description: row.description ?? null } });
      addEdge(graph, edge(sourceNode, translation, 'provides', 'quranenc', url));
    }
    return { translations: rows.length, live: true };
  } catch (error) {
    addRecord(graph, 'quranenc', sourceNode, 'translations-list-probe-failed', 'translations list probe failed', url, { error: error.message });
    return { translations: 0, live: false };
  }
}

async function addHadeethGraph(graph) {
  const connector = VERIFIED_MULTILINGUAL_CONNECTORS.find((item) => item.id === 'hadeethenc-api');
  const sourceNode = addSourceNode(graph, 'hadeethenc-api', connector.name, connector.connector.discovery.languagesUrl);
  const discovery = connector.connector.discovery;
  const result = { languages: 0, categories: 0, live: false };
  try {
    const languages = await fetchJson(discovery.languagesUrl);
    const rows = Array.isArray(languages) ? languages : (languages?.data ?? []);
    for (const row of rows.slice(0, 200)) {
      const key = row.code ?? row.language ?? row.id ?? row.iso_code;
      if (!key) continue;
      const languageNode = id('language', 'hadeethenc', key);
      if (!graph.nodes.has(languageNode)) addNode(graph, { id: languageNode, type: 'language', label: row.name ?? String(key), sourceId: 'hadeethenc-api', externalId: String(key), provenance: provenance('hadeethenc-api', discovery.languagesUrl) });
      addEdge(graph, edge(sourceNode, languageNode, 'supports_language', 'hadeethenc-api', discovery.languagesUrl));
    }
    result.languages = rows.length;
    const categories = await fetchJson(discovery.rootsUrl);
    const categoryRows = Array.isArray(categories) ? categories : (categories?.data ?? []);
    for (const row of categoryRows.slice(0, maxCategories)) {
      const key = row.id ?? row.category_id ?? row.slug;
      if (!key) continue;
      const categoryNode = id('category', 'hadeethenc', key);
      if (!graph.nodes.has(categoryNode)) addNode(graph, { id: categoryNode, type: 'category', label: row.title ?? row.name ?? String(key), sourceId: 'hadeethenc-api', externalId: String(key), provenance: provenance('hadeethenc-api', discovery.rootsUrl) });
      addEdge(graph, edge(sourceNode, categoryNode, 'has_category', 'hadeethenc-api', discovery.rootsUrl));
    }
    result.categories = categoryRows.length;
    result.live = true;
  } catch (error) {
    addRecord(graph, 'hadeethenc-api', sourceNode, 'discovery-probe-failed', 'discovery probe failed', discovery.languagesUrl, { error: error.message });
  }
  return result;
}

function addServiceCatalog(graph) {
  const sourceNode = addSourceNode(graph, 'islamenc-api', 'IslamEnc', 'https://s.islamenc.com/lang/en');
  const services = [['quranenc','QuranEnc API'],['hadeethenc','HadeethEnc API'],['islamcontent-api','IslamContent API'],['terminologyenc','TerminologyEnc']];
  for (const [key, label] of services) {
    const serviceNode = id('source_service', 'islamenc', key);
    if (!graph.nodes.has(serviceNode)) addNode(graph, { id: serviceNode, type: 'source_service', label, externalId: key, sourceId: 'islamenc-api', provenance: provenance('islamenc-api', 'https://s.islamenc.com/lang/en') });
    const e = edge(sourceNode, serviceNode, 'offers_service', 'islamenc-api', 'https://s.islamenc.com/lang/en');
    if (!graph.edges.has(e.id)) addEdge(graph, e);
  }
}

function addConnectorCatalog(graph) {
  for (const connector of VERIFIED_MULTILINGUAL_CONNECTORS) {
    const url = connector.connector.searchUrl || connector.connector.endpointTemplate || 'https://s.islamenc.com/lang/en';
    const sourceNode = addSourceNode(graph, connector.id, connector.name, url);
    const metadata = connector.connector.discovery || {};
    for (const [key, value] of Object.entries(metadata)) if (String(value).startsWith('http')) addRecord(graph, connector.id, sourceNode, key, key, value, { endpoint: value });
  }
}

async function main() {
  const graph = createGraph();
  addConnectorCatalog(graph);
  addServiceCatalog(graph);
  const stats = { terminology: { categories: 0, terms: 0 }, quranenc: { translations: 0, live: false }, hadeethenc: { languages: 0, categories: 0, live: false } };
  if (!has('catalog-only')) {
    stats.terminology = await addTerminology(graph);
    stats.quranenc = await addQuranGraph(graph);
    stats.hadeethenc = await addHadeethGraph(graph);
  }
  const validation = validateRuntimeGraph(graph);
  if (!validation.valid) throw new Error(`Invalid graph: ${validation.errors.join('; ')}`);
  const snapshot = snapshotGraph(graph);
  await mkdir(output.substring(0, output.lastIndexOf('/')), { recursive: true });
  await writeFile(output, JSON.stringify({ schema: 'deen-allah-unified-knowledge-graph/v1', generatedAt: new Date().toISOString(), acquisitionPolicy: 'discovery-does-not-grant-download-rights', apiPolicy: 'promote-only-after-verification', stats, graph: snapshot }, null, 2));
  console.log(JSON.stringify({ output, ...validation, stats }, null, 2));
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
