import { searchCorpus, verifyRecord } from "./corpus-index.js";

export function encyclopediaSearch(params = {}) {
  const results = searchCorpus(params.query, {
    sourceType: params.sourceType,
    verifiedOnly: params.verifiedOnly
  }, params.records);
  return {
    query: params.query ?? "",
    language: params.language ?? "ar",
    count: results.length,
    results
  };
}

export function encyclopediaVerify(recordId, records = []) {
  const record = records.find((item) => item.recordId === recordId);
  return verifyRecord(record);
}

export function buildResearchPacket(params = {}) {
  const response = encyclopediaSearch(params);
  return {
    query: response.query,
    language: response.language,
    claims: response.results.map((r) => ({ recordId: r.recordId, claim: r.textOriginal ?? r.titleOriginal, citation: r.citation ?? null })),
    sources: response.results.map((r) => ({ recordId: r.recordId, sourceId: r.sourceId, title: r.titleOriginal, sourceType: r.sourceType, priority: r.priority, reviewStatus: r.reviewStatus ?? "ingested" })),
    verificationSummary: {
      verifiedCount: response.results.filter((r) => verifyRecord(r).verified).length,
      unverifiedCount: response.results.filter((r) => !verifyRecord(r).verified).length
    }
  };
}
