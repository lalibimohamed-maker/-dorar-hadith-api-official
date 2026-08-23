import { unifiedKnowledgeSearch } from './unified-knowledge-search.js';
import {
  buildCrossLanguageQuery,
  resolveResponseLanguage,
  textDirection,
} from './multilingual-search-runtime.js';

function uniqueById(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item?.id || JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Runs the unified corpus+evidence search through the multilingual runtime.
 * The original query is always searched first; aliases are additional search
 * probes and never replace or rewrite the user's original query.
 */
export function multilingualUnifiedKnowledgeSearch({
  query,
  requestedLanguage,
  uiLanguage,
  aliases = [],
  options = {},
  records = [],
  graph = null,
} = {}) {
  const responseLanguage = resolveResponseLanguage({ query, requestedLanguage, uiLanguage });
  const crossLanguage = buildCrossLanguageQuery({ query, responseLanguage, aliases });
  const probes = uniqueById([
    crossLanguage.originalQuery,
    ...crossLanguage.aliases,
  ].filter(Boolean).map((value) => ({ id: value, value })));

  const searches = probes.map(({ value }) => unifiedKnowledgeSearch(
    value,
    { ...options, language: responseLanguage },
    records,
    graph,
  ));

  const results = uniqueById(searches.flatMap((search) => search.results || []))
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  const evidencePaths = uniqueById(searches.flatMap((search) => search.evidence_paths || []));

  return {
    query: crossLanguage.originalQuery,
    language: responseLanguage,
    direction: textDirection(responseLanguage),
    aliases: crossLanguage.aliases,
    search_strategy: crossLanguage.searchStrategy,
    preserve_original_text: crossLanguage.preserveOriginalText,
    results: results.slice(0, options.limit || 20),
    evidence_paths: evidencePaths.slice(0, options.maxPaths || 10),
    mode: graph ? 'multilingual-corpus+graph' : 'multilingual-corpus',
    probes: probes.map(({ value }) => value),
  };
}
