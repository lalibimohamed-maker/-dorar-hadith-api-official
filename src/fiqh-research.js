import framework from "../config/fiqh-research-framework.json" with { type: "json" };
import registry from "../config/fiqh-fatawa-sources.json" with { type: "json" };
import classical from "../config/fiqh-classical-fatwa-books.json" with { type: "json" };

function normalize(text) {
  return String(text || "")
    .toLocaleLowerCase("ar")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}

function scholarRecords() {
  const registryScholars = registry.scholars.map((scholar) => ({
    ...scholar,
    era: "contemporary",
    verification: "source-verified",
    sourceIds: [...(scholar.sourceIds || [])],
  }));
  const classicalScholars = framework.classicalMethodologists.map((scholar) => ({
    ...scholar,
    era: "classical-or-later",
    verification: "framework-record",
    sourceIds: [],
  }));
  const classicalBookAuthors = classical.authors.map((author) => ({
    id: author.id,
    nameAr: author.nameAr,
    era: "classical",
    verification: "bibliographic-record",
    sourceIds: [...(author.sourceIds || [])],
  }));
  const seen = new Set();
  return [...registryScholars, ...classicalScholars, ...classicalBookAuthors].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function listFiqhMadhahib() {
  return framework.madhahib.map((madhhab) => ({ ...madhhab }));
}

export function listFiqhResearchScholars({ query } = {}) {
  const q = normalize(query);
  return scholarRecords().filter((scholar) => !q || normalize(scholar.nameAr).includes(q));
}

export function getFiqhResearchFramework() {
  return {
    ...framework,
    sources: registry.sources,
    scholarCount: scholarRecords().length,
    policy: registry.policy,
  };
}

export function buildFiqhResearchTemplate(question, { madhhab } = {}) {
  const selectedMadhhab = framework.madhahib.find((item) => item.id === madhhab) || null;
  return {
    question: String(question || "").trim(),
    corpus: framework.scope,
    selectedMadhhab,
    sections: framework.analysisSchema.requiredSections.map((id) => ({
      id,
      status: "requires_source_evidence",
    })),
    method: {
      preserveDifferences: framework.analysisSchema.disagreementRule,
      preferredView: framework.analysisSchema.preferredViewRule,
      attribution: framework.analysisSchema.attributionRule,
      hadithAuthenticity: framework.analysisSchema.hadithRule,
      legalNotice: framework.analysisSchema.legalRule,
    },
  };
}

export function searchFiqhResearch(query) {
  const q = normalize(query);
  if (!q) return [];
  const records = [];
  for (const scholar of scholarRecords()) {
    const haystack = normalize([scholar.nameAr, ...(scholar.roles || [])].join(" "));
    if (haystack.includes(q)) {
      records.push({
        type: "scholar",
        id: scholar.id,
        title: scholar.nameAr,
        author: scholar.nameAr,
        verification: scholar.verification,
        sourceIds: scholar.sourceIds,
        corpus: "sunni",
      });
    }
  }
  for (const author of classical.authors) {
    for (const work of author.works || []) {
      const haystack = normalize(`${work.titleAr} ${author.nameAr}`);
      if (haystack.includes(q)) {
        records.push({
          type: "fiqh-book",
          id: `${author.id}:${work.titleAr}`,
          title: work.titleAr,
          author: author.nameAr,
          status: work.status,
          source: work.source,
          sourceIds: [...(author.sourceIds || [])],
          corpus: "sunni",
        });
      }
    }
  }
  return records;
}
