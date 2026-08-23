import { searchCorpus, resolveConcept } from './corpus_search.js';
import { queryEvidencePaths, rankEvidencePaths } from './graph-evidence-query.js';
import { rankEvidenceByQuality } from './evidence-quality.js';
import { explainSearchResult } from './search-quality-explanation.js';

function normalizeOptions(options = {}) {
  const limit = Number(options.limit) > 0 ? Math.min(Number(options.limit), 100) : 20;
  const maxDepth = Number.isInteger(options.maxDepth) && options.maxDepth > 0 ? Math.min(options.maxDepth, 12) : 6;
  const maxPaths = Number.isInteger(options.maxPaths) && options.maxPaths > 0 ? Math.min(options.maxPaths, 50) : 10;
  return { ...options, limit, maxDepth, maxPaths };
}

function resultNodeIds(results = []) {
  return results.map(result => result.id).filter(Boolean);
}

function sourceRegistryFrom(options = {}) {
  if (options.sourceRegistry instanceof Map) return options.sourceRegistry;
  if (Array.isArray(options.sourceRegistry)) return new Map(options.sourceRegistry.map(source => [source.id, source]));
  return new Map();
}

export function unifiedKnowledgeSearch(query, options = {}, records = [], graph = null) {
  const normalizedOptions = normalizeOptions(options);
  const corpus = searchCorpus(query, normalizedOptions, records);
  const allResults = Array.isArray(corpus?.results) ? corpus.results : [];
  const results = allResults.slice(0, normalizedOptions.limit);
  const graphPaths = [];
  const sourceRegistry = sourceRegistryFrom(normalizedOptions);

  if (graph && Array.isArray(graph.nodes) && Array.isArray(graph.edges)) {
    const startId = normalizedOptions.startId || resultNodeIds(results)[0];
    const targetIds = normalizedOptions.targetIds || resultNodeIds(results).slice(0, normalizedOptions.limit);
    if (startId && targetIds.length) {
      for (const targetId of targetIds) {
        if (targetId === startId) continue;
        const paths = queryEvidencePaths(graph, startId, targetId, normalizedOptions);
        graphPaths.push(...paths.map(path => ({ targetId, ...path })));
      }
    }
  }

  const rankedPaths = rankEvidenceByQuality(rankEvidencePaths(graphPaths), sourceRegistry).slice(0, normalizedOptions.maxPaths);
  const explainedResults = results.map(result => ({
    ...result,
    search_explanation: explainSearchResult(result, normalizedOptions)
  }));

  return {
    query,
    language: normalizedOptions.language || 'ar',
    results: explainedResults,
    evidence_paths: rankedPaths,
    mode: graph ? 'corpus+graph' : 'corpus'
  };
}

export function explainKnowledgeResult(result, graph, options = {}) {
  if (!result?.id || !graph) return { result, evidence_paths: [], search_explanation: explainSearchResult(result, options) };
  const paths = queryEvidencePaths(graph, options.startId || result.id, options.targetId || result.id, options);
  const ranked = rankEvidenceByQuality(rankEvidencePaths(paths), sourceRegistryFrom(options)).slice(0, options.maxPaths || 10);
  return { result, evidence_paths: ranked, search_explanation: explainSearchResult(result, options) };
}

export function resolveKnowledgeConcept(term, contextId, language = 'ar', records = [], options = {}) {
  return resolveConcept(term, contextId, language, records, options);
}
