const DEFAULT_TIMEOUT_MS = 1800;
const MAX_PROVIDERS = 10;

const PROVIDER_CLASSES = Object.freeze({
  web: ["google", "bing", "brave", "mojeek", "yandex", "duckduckgo"],
  quran: ["quran_sources", "web"],
  hadith: ["hadith_sources", "web"],
  tafsir: ["tafsir_sources", "web"],
  books: ["book_sources", "web"],
  fatwa: ["fatwa_sources", "web"]
});

function classifyQuery(query = "") {
  const q = query.toLowerCase();
  if (/قرآن|quran|tafsir|تفسير/.test(q)) return q.includes("تفسير") || q.includes("tafsir") ? "tafsir" : "quran";
  if (/حديث|hadith|sunnah/.test(q)) return "hadith";
  if (/كتاب|books?|pdf|docx|epub/.test(q)) return "books";
  if (/فتوى|fatwa/.test(q)) return "fatwa";
  return "web";
}

export function planSearchFederation({ query, providers = [], timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const domain = classifyQuery(query);
  const preferred = PROVIDER_CLASSES[domain] || PROVIDER_CLASSES.web;
  const specialist = preferred[0];
  const ranked = providers
    .filter((p) => p && p.id && p.enabled !== false)
    .map((p) => {
      const providerClass = p.class || p.id;
      const priority = domain === "web"
        ? 0
        : providerClass === specialist
          ? 0
          : providerClass === "web"
            ? 1
            : 2;
      return { ...p, priority };
    })
    .sort((a, b) => a.priority - b.priority || (a.latencyMs || 0) - (b.latencyMs || 0))
    .slice(0, MAX_PROVIDERS);

  return Object.freeze({
    domain,
    timeoutMs: Math.max(250, Math.min(timeoutMs, DEFAULT_TIMEOUT_MS)),
    providers: ranked
  });
}

export const SEARCH_FEDERATION_LIMITS = Object.freeze({
  maxProviders: MAX_PROVIDERS,
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS
});
