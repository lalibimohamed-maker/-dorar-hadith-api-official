import { planSearchFederation } from "./search-provider-federation.js";

const RIGHTS = new Set(["redistributable","official-view-only","link-only","rights-unclear","restricted"]);

function normalizeResult(result = {}, provider = {}) {
  const url = String(result.url || result.link || "").trim();
  const title = String(result.title || "").trim();
  return {
    ...result,
    providerId: provider.id || result.providerId || "unknown",
    providerClass: provider.class || result.providerClass || "web",
    url,
    title,
    query: result.query || null,
    discoveredAt: result.discoveredAt || new Date().toISOString(),
    provenance: {
      ...(result.provenance || {}),
      discoveryProvider: provider.id || result.providerId || "unknown",
      originalUrl: url
    },
    rights: RIGHTS.has(result.rights) ? result.rights : "rights-unclear",
    isDiscoveryOnly: true
  };
}

export function normalizeDiscoveryResults(results = [], providers = []) {
  const byId = new Map(providers.map(p => [p.id, p]));
  const seen = new Map();
  for (const raw of results) {
    const provider = byId.get(raw?.providerId) || raw?.provider || {};
    const item = normalizeResult(raw, provider);
    if (!item.url) continue;
    const key = item.url.replace(/#.*$/, "").replace(/\/$/, "").toLowerCase();
    const previous = seen.get(key);
    if (!previous || (item.title && !previous.title)) seen.set(key, item);
  }
  return [...seen.values()];
}

export function rankDiscoveryResults(results = []) {
  return [...results].sort((a,b) => {
    const rightsScore = r => ({redistributable:3,"official-view-only":2,"link-only":1,"rights-unclear":0,restricted:0}[r] ?? 0);
    const providerScore = r => r.providerClass === "official" ? 3 : r.providerClass === "institutional" ? 2 : 1;
    return providerScore(b)-providerScore(a) || rightsScore(b.rights)-rightsScore(a.rights);
  });
}

export function createDiscoveryPlan({ query, providers = [], results = [], timeoutMs } = {}) {
  const plan = planSearchFederation({ query, providers, timeoutMs });
  const allowed = new Set(plan.providers.map(p => p.id));
  const normalized = normalizeDiscoveryResults(results.filter(r => allowed.has(r?.providerId)), plan.providers);
  return Object.freeze({
    ...plan,
    results: rankDiscoveryResults(normalized),
    rule: "discovery-is-not-authority"
  });
}

export function canEnterSourceVerification(result = {}) {
  return Boolean(result.url && result.provenance?.originalUrl && result.isDiscoveryOnly === true);
}
