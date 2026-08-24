const DEFAULT_TIMEOUT_MS = 1500;
const MAX_WORKERS = 8;

export function planFederatedSearch({ query, language, providers = [], timeoutMs = DEFAULT_TIMEOUT_MS }) {
  if (typeof query !== "string" || !query.trim()) {
    return { allowed: false, state: "blocked", reason: "query_required", jobs: [] };
  }

  const eligible = providers
    .filter((provider) => provider && provider.enabled !== false)
    .slice(0, MAX_WORKERS)
    .map((provider) => ({
      providerId: provider.id,
      query: query.trim(),
      language: language || "auto",
      timeoutMs: Math.max(250, Math.min(timeoutMs, DEFAULT_TIMEOUT_MS)),
      purpose: provider.purpose || "discovery"
    }));

  return {
    allowed: true,
    state: "planned",
    strategy: "parallel-federated",
    jobs: eligible,
    maxWorkers: MAX_WORKERS,
    deadlineMs: Math.max(250, Math.min(timeoutMs, DEFAULT_TIMEOUT_MS))
  };
}

export function mergeSearchResults(resultSets) {
  const seen = new Set();
  const merged = [];

  for (const set of resultSets || []) {
    for (const item of set || []) {
      const key = item.canonicalUrl || item.id || item.url;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }

  return merged;
}
