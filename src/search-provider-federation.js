import providerNetwork from "../config/search-provider-network-2026.json" with { type: "json" };

const DEFAULT_TIMEOUT_MS = providerNetwork.limits.providerTimeoutMs;
const MAX_PROVIDERS = providerNetwork.limits.maxConcurrentProviders;
const PROVIDER_CLASSES = Object.freeze({
  quran: providerNetwork.providerCandidates.quran.map((p) => p.id),
  tafsir: providerNetwork.providerCandidates.tafsir.map((p) => p.id),
  hadith: providerNetwork.providerCandidates.hadith.map((p) => p.id),
  books: providerNetwork.providerCandidates.books.map((p) => p.id),
  fatwa: providerNetwork.providerCandidates.fatwa.map((p) => p.id),
  web: providerNetwork.providerCandidates.web.map((p) => p.id)
});

function classifyQuery(query = "") {
  const q = query.toLowerCase();
  if (/حديث|hadith|sunnah/.test(q)) return "hadith";
  if (/كتاب|books?|pdf|docx|epub|مكتبه|مكتبة/.test(q)) return "books";
  if (/فتوى|fatwa/.test(q)) return "fatwa";
  if (/تفسير|tafsir/.test(q)) return "tafsir";
  if (/قرآن|quran|مصحف|ayah|آية/.test(q)) return "quran";
  return "web";
}

function providerDefinition(id) {
  for (const group of Object.values(providerNetwork.providerCandidates)) {
    const found = group.find((provider) => provider.id === id);
    if (found) return found;
  }
  return null;
}

export function validateProviderDefinition(provider = {}) {
  const definition = providerDefinition(provider.id);
  if (!definition) return { ok: false, reason: "unknown-provider" };
  if (provider.enabled === false) return { ok: false, reason: "disabled" };
  if (definition.scrapingAllowed !== false) return { ok: false, reason: "scraping-policy-invalid" };
  if (!String(definition.integration || "").includes("api") && !String(definition.integration || "").includes("interface")) {
    return { ok: false, reason: "official-interface-required" };
  }
  return { ok: true, definition };
}

export function listProviderNetwork({ domain = null } = {}) {
  if (domain && providerNetwork.layers[domain]) {
    const ids = providerNetwork.providerCandidates[domain]?.map((p) => p.id) || [];
    return ids.map((id) => providerDefinition(id)).filter(Boolean);
  }
  return Object.fromEntries(
    Object.entries(providerNetwork.providerCandidates).map(([key, providers]) => [key, providers.map((p) => ({ ...p }))])
  );
}

export function planSearchFederation({ query, providers = [], timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const domain = classifyQuery(query);
  const preferred = PROVIDER_CLASSES[domain] || PROVIDER_CLASSES.web;
  const specialistIds = new Set(preferred);
  const ranked = providers
    .map((provider) => ({ provider, validation: validateProviderDefinition(provider) }))
    .filter(({ validation }) => validation.ok)
    .map(({ provider }) => {
      const providerClass = provider.class || provider.id;
      const priority = domain === "web"
        ? (providerClass === "web" ? 0 : 1)
        : specialistIds.has(provider.id)
          ? 0
          : providerClass === "web"
            ? 1
            : 2;
      return { ...provider, priority, integration: validation.definition.integration, scrapingAllowed: false };
    })
    .sort((a, b) => a.priority - b.priority || (a.latencyMs || 0) - (b.latencyMs || 0))
    .slice(0, MAX_PROVIDERS);

  return Object.freeze({
    domain,
    timeoutMs: Math.max(250, Math.min(timeoutMs, DEFAULT_TIMEOUT_MS)),
    providers: ranked,
    routing: {
      specializedFirst: ["quran", "tafsir", "hadith", "books", "fatwa"].includes(domain),
      fallbackToWeb: ["quran", "tafsir", "hadith", "books", "fatwa"].includes(domain),
      noScraping: true,
      officialInterfaceOnly: true
    }
  });
}

export const SEARCH_FEDERATION_LIMITS = Object.freeze({
  maxProviders: MAX_PROVIDERS,
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS
});
