import { searchDorar } from "./dorar-client.js";
import { listSources } from "./source-registry.js";
import { buildEvidence, searchUnified } from "./unified-knowledge-index.js";
import { getKnowledgeContext } from "./knowledge-context.js";
import { listShamelaSections } from "./shamela-source.js";

function sourceRecords() {
  const registryRecords = listSources().map((source) => ({
    id: source.id,
    title: source.nameAr || source.id,
    topic: source.category,
    source: source.url || source.id,
    verification: "verified",
    corpus: "sunni",
    work: source.nameAr || source.id,
    author: null,
    methodology: null,
    rights: "source-dependent",
  }));

  const shamelaRecords = listShamelaSections().map((section) => ({
    id: `shamela:${section.id}`,
    title: section.nameAr,
    topic: section.id,
    source: "https://shamela.ws/",
    verification: "bibliographic-index",
    corpus: "sunni",
    work: section.nameAr,
    author: null,
    methodology: null,
    rights: "catalog-and-link-unless-licensed",
    sectionCount: section.count,
  }));

  const seen = new Set();
  return [...registryRecords, ...shamelaRecords].filter((record) => {
    if (seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}

export async function unifiedSearch(query, { signal, includePotentialMatches = false, responseLocale = "ar" } = {}) {
  const [hadithData, sourceMatches] = await Promise.all([
    searchDorar(query, { signal }),
    Promise.resolve(searchUnified(query, sourceRecords(), {
      includePotentialMatches,
      corpus: "sunni",
      requireSource: true,
    })),
  ]);
  const knowledge = getKnowledgeContext({ query });

  return {
    query,
    responseLanguage: responseLocale,
    hadith: hadithData,
    sourceMatches: sourceMatches.map((item) => ({ ...item, evidence: buildEvidence(item) })),
    knowledge,
    policy: {
      corpus: "sunni",
      responseLanguageMustMatchSelectedLocale: true,
      originalArabicDistinctFromTranslation: true,
      potentialMatchesSeparated: !includePotentialMatches,
      sourceAttributionRequired: true,
      hadithAuthenticityMustBeReadFromItsGrading: true,
      sirahSourceDoesNotImplyNarrationAuthenticity: true,
      shamelaIsBibliographicAndNavigationSourceByDefault: true,
    },
  };
}
