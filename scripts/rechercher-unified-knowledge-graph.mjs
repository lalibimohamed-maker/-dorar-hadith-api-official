import { mkdir, writeFile } from 'node:fs/promises';
import { createGraph, addNode, addEdge, snapshotGraph, validateRuntimeGraph } from '../src/deen-graph-runtime.js';
import DEEP_SOURCES from '../config/rechercher-islamcontent-terminology-deep-registry-v1.js';
import { VERIFIED_MULTILINGUAL_CONNECTORS } from '../config/rechercher-verified-multilingual-connectors.js';

const UA = 'Rechercher-Unified-Knowledge-Graph/1.0';
const DEFAULT_LANGS = ['ar', 'en', 'fr'];
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

async function addTerminology(graph) {
  const source = DEEP_SOURCES.find((item) => item.id === 'terminologyenc-deep');
  const sourceNode = addSourceNode(graph, 'terminologyenc', 'TerminologyEnc', source.baseUrl);
  const languages = source.languages;
  for (const lang of languages) {
    const langNode = id('language', 'terminologyenc', lang);
    addNode(graph, { id: langNode, type: 'language', label: lang, language: lang, provenance: provenance('terminologyenc', `${source.baseUrl}/${lang}/home`) });
    addEdge(graph, edge(sourceNode, langNode, 'supports_language', 'terminologyenc', `${source.baseUrl}/${lang}/home`));
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
      addEdge(graph, edge(sourceNode, categoryNode, 'has_category', 'terminologyenc', url));
      const links = htmlLinks(categoryPage.text, categoryPage.url);
      for (const termUrl of links) {
        const termMatch = termUrl.match(new RegExp(`/${lang}/browse/term/(\\d+)`));
        if (!termMatch || seenTerms.size >= maxTerms) continue;
        const termKey = termMatch[1];
        if (seenTerms.has(termKey)) continue;
        seenTerms.add(termKey);
        const termPage = await fetchText(termUrl).catch(() => null);
        if (!termPage) continue;
        const termNode = id('term', 'terminologyenc', termKey);
        const title = titleFromHtml(termPage.text) || `term-${termKey}`;
        addNode(graph, { id: termNode, type: 'term', label: title, sourceId: 'terminologyenc', externalId: termKey, language: lang, provenance: provenance('terminologyenc', termUrl), metadata: { categoryId: categoryKey } });
        addEdge(graph, edge(categoryNode, termNode, 'has_term', 'terminologyenc', termUrl));
        addEdge(graph, edge(termNode, sourceNode, 'discovered_from', 'terminologyenc', termUrl));
      }
    }
  }
  return { categories: seenCategories.size, terms: seenTerms.size };
}

function addServiceCatalog(graph) {
  const sourceNode = addSourceNode(graph, 'islamenc-api', 'IslamEnc', 'https://s.islamenc.com/lang/en');
  const services = [
    ['quranenc', 'QuranEnc API'],
    ['hadeethenc', 'HadeethEnc API'],
    ['islamcontent-api', 'IslamContent API'],
    ['terminologyenc', 'TerminologyEnc'],
  ];
  for (const [key, label] of services) {
    const serviceNode = id('source_service', 'islamenc', key);
    addNode(graph, { id: serviceNode, type: 'source_service', label, externalId: key, sourceId: 'islamenc-api', provenance: provenance('islamenc-api', 'https://s.islamenc.com/lang/en') });
    addEdge(graph, edge(sourceNode, serviceNode, 'offers_service', 'islamenc-api', 'https://s.islamenc.com/lang/en'));
  }
}

function addConnectorCatalog(graph) {
  for (const connector of VERIFIED_MULTILINGUAL_CONNECTORS) {
    const sourceNode = addSourceNode(graph, connector.id, connector.name, connector.connector.searchUrl || connector.connector.endpointTemplate || 'https://s.islamenc.com/lang/en');
    const metadata = connector.connector.discovery || {};
    for (const [key, value] of Object.entries(metadata)) {
      if (!String(value).startsWith('http')) continue;
      const recordNode = id('source_record', connector.id, key);
      addNode(graph, { id: recordNode, type: 'source_record', label: key, sourceId: connector.id, provenance: provenance(connector.id, value), metadata: { endpoint: value } });
      addEdge(graph, edge(sourceNode, recordNode, 'provides', connector.id, value));
    }
  }
}

async function main() {
  const graph = createGraph();
  addConnectorCatalog(graph);
  addServiceCatalog(graph);
  let terminology = { categories: 0, terms: 0 };
  if (!has('catalog-only')) terminology = await addTerminology(graph);
  const validation = validateRuntimeGraph(graph);
  if (!validation.valid) throw new Error(`Invalid graph: ${validation.errors.join('; ')}`);
  const snapshot = snapshotGraph(graph);
  await mkdir(output.substring(0, output.lastIndexOf('/')), { recursive: true });
  await writeFile(output, JSON.stringify({ schema: 'deen-allah-unified-knowledge-graph/v1', generatedAt: new Date().toISOString(), acquisitionPolicy: 'discovery-does-not-grant-download-rights', apiPolicy: 'promote-only-after-verification', stats: { nodes: snapshot.nodes.length, edges: snapshot.edges.length, terminology }, graph: snapshot }, null, 2));
  console.log(JSON.stringify({ output, ...validation, terminology }, null, 2));
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
