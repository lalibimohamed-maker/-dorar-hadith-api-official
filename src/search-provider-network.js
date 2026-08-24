export const SEARCH_PROVIDERS = Object.freeze([
  "primary",
  "provider-b",
  "provider-c",
  "provider-d"
]);

export async function runSearchNetwork(query, providers, { timeoutMs = 1200, maxProviders = 8 } = {}) {
  if (!query?.trim()) return { results: [], providers: [], timedOut: false };

  const selected = providers.filter(Boolean).slice(0, maxProviders);
  const settled = await Promise.allSettled(selected.map(async (provider) => {
    const result = await Promise.race([
      Promise.resolve(provider.search(query)),
      new Promise((_, reject) => setTimeout(() => reject(new Error("provider_timeout")), timeoutMs))
    ]);
    return { provider: provider.id, results: Array.isArray(result) ? result : [] };
  }));

  const seen = new Set();
  const results = [];
  for (const item of settled) {
    if (item.status !== "fulfilled") continue;
    for (const result of item.value.results) {
      const key = result.url || `${result.title || ""}\n${result.snippet || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ ...result, discoveredBy: item.value.provider });
    }
  }

  return { results, providers: selected.map((p) => p.id), timedOut: settled.some((x) => x.status === "rejected") };
}
