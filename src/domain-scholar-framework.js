import framework from "../config/domain-scholar-framework.json" with { type: "json" };
import { buildScholarResearchProfile, compareScholarOpinions, getScholarResearchPolicy } from "./scholar-research.js";

export function listKnowledgeDomains() {
  return Object.entries(framework.domains).map(([id, domain]) => ({
    id,
    method: [...domain.method],
    scholars: domain.scholars.map((scholar) => ({ ...scholar })),
  }));
}

export function getDomainScholarFramework(domainId) {
  const domain = framework.domains[domainId];
  if (!domain) return null;
  return {
    id: domainId,
    method: [...domain.method],
    scholars: domain.scholars.map((scholar) => ({ ...scholar })),
    rules: { ...framework.researchRules },
  };
}

export function searchDomainScholars(query, domainId) {
  const q = String(query || "").trim().toLocaleLowerCase("ar");
  const domains = domainId ? [[domainId, framework.domains[domainId]]] : Object.entries(framework.domains);
  return domains.flatMap(([id, domain]) => {
    if (!domain) return [];
    return domain.scholars
      .filter((scholar) => !q || scholar.nameAr.toLocaleLowerCase("ar").includes(q))
      .map((scholar) => ({
        ...scholar,
        domain: id,
        researchProfile: buildScholarResearchProfile(scholar.id),
        opinionComparison: compareScholarOpinions(scholar.id),
      }));
  });
}

export function getDomainResearchPolicy() {
  return { ...framework.researchRules, scholarOpinionResearch: getScholarResearchPolicy() };
}
