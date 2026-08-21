import { searchDorar } from "./dorar-client.js";
import { listSources } from "./source-registry.js";
import { buildEvidence, searchUnified } from "./unified-knowledge-index.js";
import { getKnowledgeContext } from "./knowledge-context.js";

function sourceRecords() {
  return listSources().map((source) => ({
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
}

export async function unifiedSearch(query, { signal, includePotentialMatches = false } = {}) {
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
    hadith: hadithData,
    sourceMatches: sourceMatches.map((item) => ({ ...item, evidence: buildEvidence(item) })),
    knowledge,
    policy: {
      corpus: "sunni",
      originalArabicDistinctFromTranslation: true,
      potentialMatchesSeparated: !includePotentialMatches,
      sourceAttributionRequired: true,
      hadithAuthenticityMustBeReadFromItsGrading: true,
      sirahSourceDoesNotImplyNarrationAuthenticity: true,
    },
  };
}
