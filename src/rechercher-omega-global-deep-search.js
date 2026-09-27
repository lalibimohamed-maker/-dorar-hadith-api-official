/**
 * Rechercher Ω — Global Deep Search / Worldwide Source Generator.
 *
 * This module generates reproducible discovery plans. It does not fetch
 * arbitrary URLs and does not promote discovery into Corpus evidence.
 */
const DEFAULT_CONFIG = new URL("../config/rechercher-omega-global-deep-search.json", import.meta.url);
const DEFAULT_REGISTRY = new URL("../config/source-registry.json", import.meta.url);
const DEFAULT_QUEUE = new URL("../config/global-source-ingestion-queue-2026.json", import.meta.url);

const DEFAULT_VARIANTS = Object.freeze({
  ar: ["عربي", "عربية", "المكتبة الإسلامية", "كتب", "مخطوط", "تحقيق"],
  en: ["Islamic", "Arabic", "book", "manuscript", "digital library"],
  fr: ["islamique", "arabe", "livre", "manuscrit", "bibliothèque"],
  ru: ["ислам", "арабский", "книга", "рукопись", "библиотека"],
  tr: ["İslami", "Arapça", "kitap", "yazma", "kütüphane"],
  ur: ["اسلام", "عربی", "کتاب", "مخطوط", "کتب خانہ"],
  fa: ["اسلامی", "عربی", "کتاب", "نسخه خطی", "کتابخانه"],
  id: ["Islam", "Arab", "buku", "manuskrip", "perpustakaan"],
  ms: ["Islam", "Arab", "buku", "manuskrip", "perpustakaan"],
  de: ["islamisch", "arabisch", "Buch", "Handschrift", "Bibliothek"],
  es: ["islámico", "árabe", "libro", "manuscrito", "biblioteca"],
  pt: ["islâmico", "árabe", "livro", "manuscrito", "biblioteca"],
  it: ["islamico", "arabo", "libro", "manoscritto", "biblioteca"],
  zh: ["伊斯兰", "阿拉伯", "书籍", "手稿", "图书馆"],
  ja: ["イスラム", "アラビア語", "書籍", "写本", "図書館"],
  ko: ["이슬람", "아랍어", "도서", "필사본", "도서관"],
  bn: ["ইসলাম", "আরবি", "বই", "পাণ্ডুলিপি", "গ্রন্থাগার"],
  sw: ["Islamu", "Kiarabu", "kitabu", "mswada", "maktaba"],
  ha: ["Musulunci", "Larabci", "littafi", "rubutun hannu", "ɗakin karatu"],
  ta: ["இஸ்லாமிய", "அரபு", "நூல்", "கையெழுத்துப் பிரதிகள்", "நூலகம்"]
});

async function readJson(url) {
  const fs = await import("node:fs/promises");
  return JSON.parse(await fs.readFile(url, "utf8"));
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function slug(value) {
  return clean(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 90);
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function deterministicQueries({ title, author, language, sourceFamily, country, institution }) {
  const vars = DEFAULT_VARIANTS[language] ?? [];
  const subject = clean([title, author].filter(Boolean).join(" "));
  const suffix = [country, institution].filter(Boolean).join(" ");
  const variant = vars.slice(0, 3).join(" OR ");
  const family = sourceFamily.replace(/_/g, " ");
  const queries = [
    [subject, variant, family, suffix],
    [subject, country, institution, family],
    [title, author, "pdf", country].filter(Boolean).join(" "),
    [title, author, "catalog", country].filter(Boolean).join(" "),
    [title, author, "manuscript", institution].filter(Boolean).join(" ")
  ].map(clean).filter(Boolean);
  return unique(queries);
}

export function buildGlobalDeepSearchPlan({
  title,
  author = "",
  author_death_hijri = null,
  countries = [],
  languages = [],
  institutions = [],
  sourceFamilies = [],
  maxQueries = 500,
  seedSources = []
} = {}) {
  if (!clean(title)) throw new TypeError("title is required");

  const configPromise = readJson(DEFAULT_CONFIG);
  const registryPromise = readJson(DEFAULT_REGISTRY);
  const queuePromise = readJson(DEFAULT_QUEUE);
  return Promise.all([configPromise, registryPromise, queuePromise]).then(([config, registry, queue]) => {
    const activeLanguages = unique(languages.length ? languages : config.language_facets).slice(0, 30);
    const activeFamilies = unique(sourceFamilies.length ? sourceFamilies : config.source_families).slice(0, 30);
    const registryCountries = unique((registry.sources || []).map(source => source.country));
    const queueCountries = unique((queue.queues || []).flatMap(item => item.countries || []));
    const activeCountries = unique(countries.length ? countries : [...registryCountries, ...queueCountries]).slice(0, 250);
    const activeInstitutions = unique(institutions.length ? institutions : (registry.sources || []).map(source => source.nameAr || source.nameEn || source.id)).slice(0, 250);
    const candidates = [];
    let counter = 0;

    for (const country of activeCountries.length ? activeCountries : ["worldwide"]) {
      for (const language of activeLanguages) {
        for (const sourceFamily of activeFamilies) {
          const institutionPool = institutions.length ? activeInstitutions.filter(name => name.includes(country) || !country || country === "worldwide") : [""];
          for (const institution of institutionPool.length ? institutionPool : [""]) {
            for (const query of deterministicQueries({ title, author, language, sourceFamily, country, institution })) {
              if (counter >= maxQueries) break;
              counter += 1;
              candidates.push({
                query_id: "gds-" + slug([title, author, country, language, sourceFamily, counter].join("-")),
                query,
                title: clean(title),
                author: clean(author),
                author_death_hijri,
                language,
                region_or_country: country,
                institution: clean(institution) || null,
                source_family: sourceFamily,
                intent: sourceFamily === "book_catalog" || sourceFamily === "bibliographic_index" ? "bibliographic_discovery" : "source_discovery",
                priority: sourceFamily === "official_government" || sourceFamily === "official_quran" ? 1 : 2,
                rights_required: true,
                evidence_required: true,
                discovery_only: true,
                corpus_write_allowed: false
              });
            }
            if (counter >= maxQueries) break;
          }
          if (counter >= maxQueries) break;
        }
        if (counter >= maxQueries) break;
      }
      if (counter >= maxQueries) break;
    }

    return {
      schema_version: "1.0.0",
      engine: "rechercher-omega",
      module: "global-deep-search",
      mode: "discovery_and_planning",
      title: clean(title),
      author: clean(author) || null,
      author_death_hijri,
      seed_source_count: seedSources.length || (registry.sources || []).length,
      countries_considered: activeCountries,
      languages_considered: activeLanguages,
      source_families_considered: activeFamilies,
      queries_generated: candidates.length,
      queries: candidates,
      gates: {
        source_verification_required: true,
        rights_verification_required: true,
        provenance_required: true,
        corpus_write_allowed: false,
        generated_media_is_evidence: false,
        arbitrary_url_fetch_from_ai: false
      }
    };
  });
}

export async function generateAIAugmentedSearchPlan({ provider, ...input } = {}) {
  const base = await buildGlobalDeepSearchPlan(input);
  if (!provider) return base;

  if (typeof provider.generate !== "function") throw new TypeError("provider.generate must be a function");
  const prompt = [
    "Generate additional discovery query variants only.",
    "Do not invent URLs, source permissions, editions, or factual claims.",
    "Return JSON array of short search queries.",
    "Target worldwide Islamic/Sunni scholarly sources across languages and country institutions.",
    "Title:", base.title,
    "Author:", base.author || "unknown"
  ].join("\n");

  const result = await provider.generate({
    messages: [{ role: "system", content: "Rechercher Ω source-discovery generator. Discovery is not evidence." }, { role: "user", content: prompt }],
    temperature: 0
  });

  let generated = [];
  try {
    const parsed = JSON.parse(result.text ?? "[]");
    generated = Array.isArray(parsed) ? parsed : [];
  } catch {
    generated = [];
  }

  const additions = unique(generated
    .map(clean)
    .filter(query => query.length >= 8 && query.length <= 300))
    .slice(0, 100)
    .map((query, index) => ({
      query_id: "gds-ai-" + slug([base.title, index + 1].join("-")),
      query,
      title: base.title,
      author: base.author,
      language: null,
      region_or_country: "worldwide",
      institution: null,
      source_family: "ai_augmented_discovery",
      intent: "source_discovery",
      priority: 3,
      rights_required: true,
      evidence_required: true,
      discovery_only: true,
      corpus_write_allowed: false
    })));

  return {
    ...base,
    ai_augmented_queries: additions,
    queries_generated_total: base.queries.length + additions.length,
    ai_provider: result.provider ?? null,
    ai_model: result.model ?? null
  };
}

export function assertGlobalDeepSearchBoundary(plan) {
  if (plan?.gates?.corpus_write_allowed) throw new Error("Global deep search cannot write to Corpus");
  if (plan?.gates?.arbitrary_url_fetch_from_ai) throw new Error("Global deep search cannot perform arbitrary AI URL fetching");
  for (const query of [...(plan?.queries || []), ...(plan?.ai_augmented_queries || [])]) {
    if (query.discovery_only !== true || query.rights_required !== true || query.evidence_required !== true) {
      throw new Error("Global deep search query lost discovery/rights/evidence boundaries");
    }
  }
  return true;
}
