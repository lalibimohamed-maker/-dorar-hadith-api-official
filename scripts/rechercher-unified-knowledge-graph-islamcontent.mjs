import { readFile, writeFile } from 'node:fs/promises';

const input = process.env.RECHERCHER_GRAPH_OUTPUT || 'artifacts/rechercher/unified-knowledge-graph.json';
const UA = 'Rechercher-Unified-Knowledge-Graph/1.1';
const MAX = Number(process.env.RECHERCHER_GRAPH_MAX_RECORDS || 200);

const slug = (v) => String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '-').replace(/^-|-$/g, '').slice(0, 180);
const id = (type, source, key) => `${type}:${source}:${slug(key)}`;
const provenance = (sourceId, citation, verificationState = 'source_verified') => ({ sourceId, citation, verificationState, retrievedBy: 'rechercher-unified-knowledge-graph-v1' });
const edge = (from, to, type, sourceId, citation) => ({ id: `edge:${sourceId}:${slug(`${from}|${to}|${type}`)}`, from, to, type, provenance: provenance(sourceId, citation) });
const has = (graph, nodeId) => graph.nodes.some((n) => n.id === nodeId);
const addNode = (graph, n) => { if (!has(graph, n.id)) graph.nodes.push(n); return n.id; };
const addEdge = (graph, e) => { if (!graph.edges.some((x) => x.id === e.id)) graph.edges.push(e); };
async function json(url) { const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } }); if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`); return r.json(); }
async function main() {
  const doc = JSON.parse(await readFile(input, 'utf8'));
  const graph = doc.graph;
  const sourceId = 'islamcontent-api';
  const sourceNode = addNode(graph, { id: id('knowledge_source', sourceId, sourceId), type: 'knowledge_source', label: 'IslamContent', sourceId, provenance: provenance(sourceId, 'https://islamcontent.com/en/developers_api'), metadata: { apiDiscoveryStatus: 'documented-pending-live-verification', apiAgnosticGraph: true } });
  const endpointNodes = [
    ['categories','GET /Api/categories?lang={lang}'],
    ['content','GET /Api/content?lang={lang}'],
    ['content-filtered','GET /Api/content?lang={lang}&name={name}&subject_category={subject_category}&author={author}&sort_by={sort_by}'],
    ['languages','GET /Api/languages'],
    ['authors','GET /Api/authors?lang={lang}&name={name}'],
    ['single-content','GET /Api/single-content?id={id}'],
  ];
  for (const [key,label] of endpointNodes) { const n = addNode(graph, { id: id('source_record', sourceId, key), type: 'source_record', label, sourceId, externalId: key, provenance: provenance(sourceId, 'https://islamcontent.com/en/developers_api'), metadata: { apiStatus: 'documented-pending-live-verification' } }); addEdge(graph, edge(sourceNode, n, 'provides', sourceId, 'https://islamcontent.com/en/developers_api')); }
  const langs = ['ar','en','fr'];
  for (const lang of langs) {
    const ln = addNode(graph, { id: id('language', sourceId, lang), type: 'language', label: lang, language: lang, sourceId, provenance: provenance(sourceId, `https://islamcontent.com/${lang}/categories`) });
    addEdge(graph, edge(sourceNode, ln, 'supports_language', sourceId, `https://islamcontent.com/${lang}/categories`));
  }
  let live = false; let contentTypes = 0;
  try {
    const data = await json('https://islamcontent.com/download-request?name=iscontent.postman_collection.json');
    const text = JSON.stringify(data);
    const matches = [...text.matchAll(/(?:khotab|books|applications|audios|articles|videos|fatwa|posters|cards|quran|favorites|news|programsv)/gi)].map((m) => m[0].toLowerCase());
    const unique = [...new Set(matches)].slice(0, MAX);
    for (const type of unique) { const n = addNode(graph, { id: id('category', sourceId, type), type: 'category', label: type, sourceId, provenance: provenance(sourceId, 'https://islamcontent.com/download-request?name=iscontent.postman_collection.json'), metadata: { discoveredFrom: 'official-postman-collection' } }); addEdge(graph, edge(sourceNode, n, 'has_category', sourceId, 'https://islamcontent.com/download-request?name=iscontent.postman_collection.json')); }
    contentTypes = unique.length; live = true;
  } catch (error) {
    const n = addNode(graph, { id: id('source_record', sourceId, 'postman-probe'), type: 'source_record', label: 'official Postman collection probe', sourceId, provenance: provenance(sourceId, 'https://islamcontent.com/en/developers_api'), metadata: { live: false, error: error.message } });
    addEdge(graph, edge(sourceNode, n, 'provides', sourceId, 'https://islamcontent.com/en/developers_api'));
  }
  doc.sources = [...new Set([...(doc.sources || []), 'islamcontent-api'])];
  doc.stats = { ...(doc.stats || {}), islamcontent: { languages: langs.length, contentTypes, live } };
  doc.graph = graph;
  await writeFile(input, JSON.stringify(doc, null, 2));
  console.log(JSON.stringify({ input, islamcontent: doc.stats.islamcontent, nodes: graph.nodes.length, edges: graph.edges.length }, null, 2));
}
main().catch((e) => { console.error(e.stack || e); process.exitCode = 1; });
