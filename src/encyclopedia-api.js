import { searchFreeCore } from "./free-core.js";
import { getCorpusProvenancePolicy, validateCorpusRecord } from "./corpus-provenance.js";
import { findDomainsForSource, findSourcesForDomain } from "./corpus-source-map.js";

export function searchEncyclopedia(query, options = {}) {
  const result = searchFreeCore(query, options);
  return {
    ...result,
    apiVersion: "2026-08-23",
    provenancePolicy: "required",
    results: result.results.map((item) => ({
      ...item,
      domains: item.sourceId ? findDomainsForSource(item.sourceId) : [],
      provenance: item.sourceId
        ? validateCorpusRecord({
            recordId: item.id ?? item.sourceId,
            sourceId: item.sourceId,
            sourceType: item.sourceType ?? "book",
            verificationState: item.reviewStatus ?? item.verificationState ?? "pending_review",
            attribution: { title: item.titleOriginal ?? item.title ?? null }
          })
        : null
    }))
  };
}

export function getEncyclopediaSourceInfo(sourceId) {
  return {
    sourceId,
    domains: findDomainsForSource(sourceId),
    relatedSources: findDomainsForSource(sourceId).flatMap(findSourcesForDomain),
    provenancePolicy: getCorpusProvenancePolicy().name
  };
}

export function getEncyclopediaDomainInfo(domain) {
  return {
    domain,
    sources: findSourcesForDomain(domain),
    provenancePolicy: getCorpusProvenancePolicy().name
  };
}
