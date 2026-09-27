/**
 * Rechercher Ω — Global Deep Search.
 *
 * Thin discovery planner only. The source registry owns source identity;
 * the existing source-engines own network/search execution; Ω owns routing
 * and governance. This module does not create a second source database or
 * a second acquisition engine.
 */

const REGISTRY = new URL("../config/source-registry.json", import.meta.url);
const LANGUAGES = new URL("../config/language-coverage-2026.json", import.meta.url);
const QUEUE = new URL("../config/global-source-ingestion-queue-2026.json", import.meta.url);
const SCHOLARLY_FLEET = new URL("../config/rechercher-omega-scholarly-fleet.json", import.meta.url);

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

function sourceFamily(source) {
  if (source.category) return source.category;
  if (source.role) return source.role;
  return "general";
}

function buildQuery({ title, author, language, family, country, source }) {
  const subject = clean([title, author].filter(Boolean).join(" "));
  const sourceName = clean(source?.nameAr || source?.nameEn || "");
  const countryPart = clean(country);
  const languagePart = clean(language);
  return clean([subject, sourceName, countryPart, languagePart, family, "catalog"].filter(Boolean).join(" "));
}

export async function buildGlobalDeepSearchPlan({
  title,
  author = "",
  author_death_hijri = null,
  countries = [],
  languages = [],
  sourceFamilies = [],
  maxQueries = 500,
  seedSources = []
} = {}) {
  if (!clean(title)) throw new TypeError("title is required");

  const [registry, languageCoverage, queue, scholarlyFleet] = await Promise.all([
    readJson(REGISTRY),
    readJson(LANGUAGES),
    readJson(QUEUE),
    readJson(SCHOLARLY_FLEET)
  ]);

  const sources = registry.sources || [];
  const registryCountries = sources.map(source => source.country);
  const queueCountries = (queue.queues || []).flatMap(item => item.countries || []);
  const activeCountries = unique(countries.length ? countries : [...registryCountries, ...queueCountries]);
  const activeLanguages = unique(
    languages.length
      ? languages
      : (languageCoverage.agreed20 || []).map(language => language.code)
  );
  const declaredScholarlyFamilies = (scholarlyFleet.families || []).map(family => family.id);
  const activeFamilies = unique(
    sourceFamilies.length
      ? sourceFamilies
      : [...sources.map(sourceFamily), ...declaredScholarlyFamilies]
  );

  const sourceByFamilyCountry = new Map();
  const fleetFamilies = new Set(declaredScholarlyFamilies);
  for (const source of sources) {
    const key = [sourceFamily(source), clean(source.country) || "worldwide"].join("::");
    if (!sourceByFamilyCountry.has(key)) sourceByFamilyCountry.set(key, source);
  }

  const queries = [];
  let counter = 0;
  for (const country of activeCountries.length ? activeCountries : ["worldwide"]) {
    for (const language of activeLanguages) {
      for (const family of activeFamilies) {
        if (counter >= maxQueries) break;
        const candidates = country === "worldwide"
          ? sources.filter(source => sourceFamily(source) === family).slice(0, 1)
          : [sourceByFamilyCountry.get([family, country].join("::"))].filter(Boolean);

        const fallback = fleetFamilies.has(family) ? [{ category: family, fleet_family: true }] : [{ category: family }];
        for (const source of candidates.length ? candidates : fallback) {
          if (counter >= maxQueries) break;
          counter += 1;
          queries.push({
            query_id: "gds-" + slug([title, author, country, language, family, counter].join("-")),
            query: buildQuery({ title, author, language, family, country, source }),
            title: clean(title),
            author: clean(author) || null,
            author_death_hijri,
            language,
            region_or_country: country,
            source_id: source.id || null,
            source_family: family,
            intent: family === "book_catalog" || family === "library" ? "bibliographic_discovery" : "source_discovery",
            priority: family === "official" || family === "quran" ? 1 : 2,
            discovery_only: true,
            evidence_required: true,
            rights_required: true,
            corpus_write_allowed: false
          });
        }
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
    seed_source_count: seedSources.length || sources.length,
    countries_considered: activeCountries,
    languages_considered: activeLanguages,
    source_families_considered: activeFamilies,
    scholarly_families_declared: declaredScholarlyFamilies,
    scholarly_fleet_contract_axes: scholarlyFleet.contract?.required_axes || [],
    queries_generated: queries.length,
    queries,
    gates: {
      source_verification_required: true,
      rights_verification_required: true,
      provenance_required: true,
      corpus_write_allowed: false,
      generated_media_is_evidence: false,
      arbitrary_url_fetch_from_ai: false
    }
  };
}

export async function generateAIAugmentedSearchPlan({ provider, ...input } = {}) {
  const base = await buildGlobalDeepSearchPlan(input);
  if (!provider) return base;
  if (typeof provider.generate !== "function") throw new TypeError("provider.generate must be a function");

  const result = await provider.generate({
    messages: [
      { role: "system", content: "Rechercher Ω discovery planner. Return only search-query variants. Never invent URLs, rights, editions or evidence." },
      { role: "user", content: [
        "Generate additional short search-query variants for worldwide source discovery.",
        "Title:", base.title,
        "Author:", base.author || "unknown",
        "Languages:", base.languages_considered.join(", ")
      ].join("\n") }
    ],
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
      source_id: null,
      source_family: "ai_augmented_discovery",
      intent: "source_discovery",
      priority: 3,
      discovery_only: true,
      evidence_required: true,
      rights_required: true,
      corpus_write_allowed: false
    }));

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
