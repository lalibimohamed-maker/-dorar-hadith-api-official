import domainFramework from "../config/domain-scholar-framework.json" with { type: "json" };
import contemporary from "../config/contemporary-sunni-scholars.json" with { type: "json" };
import fiqhSources from "../config/fiqh-fatawa-sources.json" with { type: "json" };
import researchPlan from "../config/scholar-opinions-research-plan.json" with { type: "json" };
import opinionsIndex from "../config/scholar-opinions-index.json" with { type: "json" };

function allScholars() {
  const map = new Map();
  for (const [domain, value] of Object.entries(domainFramework.domains || {})) {
    for (const scholar of value.scholars || []) {
      const current = map.get(scholar.id) || { ...scholar, domains: [] };
      if (!current.domains.includes(domain)) current.domains.push(domain);
      map.set(scholar.id, current);
    }
  }
  for (const scholar of contemporary.scholars || []) {
    const current = map.get(scholar.id) || { ...scholar, domains: [] };
    current.sources = scholar.sources || [];
    current.contentTypes = scholar.contentTypes || [];
    current.role = scholar.role;
    map.set(scholar.id, current);
  }
  for (const scholar of fiqhSources.scholars || []) {
    const current = map.get(scholar.id) || { ...scholar, domains: [] };
    current.fatwaSourceIds = scholar.sourceIds || [];
    map.set(scholar.id, current);
  }
  return [...map.values()];
}

function indexedSubjects() {
  return new Set((opinionsIndex.records || []).map((record) => record.subjectScholarId));
}

export function buildScholarOpinionBatch({ offset = 0, limit = 25, query = "" } = {}) {
  const scholars = allScholars().filter((scholar) => !query || scholar.nameAr.includes(query) || scholar.id.includes(query));
  const selected = scholars.slice(offset, offset + limit);
  const indexed = indexedSubjects();
  const batches = selected.map((scholar) => ({
    subjectScholarId: scholar.id,
    subjectScholarNameAr: scholar.nameAr,
    domains: scholar.domains || [],
    status: indexed.has(scholar.id) ? "has-indexed-evidence" : "needs-source-research",
    sourceTargets: scholar.sources || [],
    searchTasks: researchPlan.sourceLayers.map((layer) => ({
      layer,
      query: `${scholar.nameAr} قال فيه العلماء ${layer}`,
      verification: "unverified",
    })),
    requiredFields: [...researchPlan.evidenceFields],
    rule: "لا تُرقّى النتيجة إلى verified آليًا؛ يلزم التحقق من المصدر ونسبة القول وسياقه.",
  }));
  return {
    generatedAt: new Date().toISOString(),
    offset,
    limit,
    totalScholars: scholars.length,
    returned: batches.length,
    autoPromotionToVerified: false,
    policy: researchPlan.policy,
    collectionOrder: researchPlan.collectionOrder,
    batches,
  };
}
