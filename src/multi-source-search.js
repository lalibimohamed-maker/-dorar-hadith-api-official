/**
 * Provider-agnostic discovery layer.
 * Search providers only discover candidates; they never grant reuse rights.
 */

const providers = new Map();

export function registerSearchProvider({ id, name, search, languages = [], capabilities = [] }) {
  if (!id || !name || typeof search !== 'function') {
    throw new Error('Search provider requires id, name and search()');
  }
  providers.set(id, Object.freeze({ id, name, search, languages: [...languages], capabilities: [...capabilities] }));
}

export function listSearchProviders() {
  return [...providers.values()].map(({ id, name, languages, capabilities }) => ({
    id, name, languages: [...languages], capabilities: [...capabilities],
  }));
}

export function buildSearchQueries(query, { languages = ['ar', 'en', 'fr'], variants = [] } = {}) {
  const base = String(query ?? '').trim();
  if (!base) return [];
  const generated = [base, ...variants.map((value) => String(value).trim()).filter(Boolean)];
  return [...new Set(generated)].map((text) => ({ text, languages: [...languages] }));
}

function canonicalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return String(value ?? '').trim();
  }
}

function normalizeCandidate(candidate, provider, query) {
  if (!candidate || !candidate.url) return null;
  return {
    ...candidate,
    url: canonicalizeUrl(candidate.url),
    provider,
    query,
    rightsStatus: candidate.rightsStatus ?? 'rights-unclear',
    redistributionAllowed: candidate.redistributionAllowed === true,
    provenance: {
      ...(candidate.provenance ?? {}),
      discoveryProvider: provider,
      discoveryQuery: query,
    },
  };
}

export function mergeSearchResults(results = []) {
  const byUrl = new Map();
  for (const result of results) {
    const normalized = normalizeCandidate(result, result?.provider ?? 'unknown', result?.query ?? '');
    if (!normalized) continue;
    const key = normalized.url;
    const previous = byUrl.get(key);
    if (!previous || Number(normalized.redistributionAllowed) > Number(previous.redistributionAllowed)) {
      byUrl.set(key, normalized);
    }
  }
  return [...byUrl.values()];
}

export async function discoverAcrossProviders(query, { providerIds, languages, variants } = {}) {
  const selected = (providerIds ?? [...providers.keys()]).map((id) => providers.get(id)).filter(Boolean);
  const queries = buildSearchQueries(query, { languages, variants });
  const results = [];
  for (const provider of selected) {
    for (const searchQuery of queries) {
      const found = await provider.search(searchQuery);
      for (const candidate of Array.isArray(found) ? found : []) {
        const normalized = normalizeCandidate(candidate, provider.id, searchQuery.text);
        if (normalized) results.push(normalized);
      }
    }
  }
  return mergeSearchResults(results);
}

export function rankSearchResults(results = []) {
  const sourceRank = { official: 40, academic: 35, publisher: 30, library: 25, archive: 20, press: 15, secondary: 5 };
  return [...results].sort((a, b) => {
    const rights = Number(b.redistributionAllowed) - Number(a.redistributionAllowed);
    if (rights) return rights;
    const source = (sourceRank[b.sourceType] ?? 0) - (sourceRank[a.sourceType] ?? 0);
    if (source) return source;
    return Number(b.confidence ?? 0) - Number(a.confidence ?? 0);
  });
}
