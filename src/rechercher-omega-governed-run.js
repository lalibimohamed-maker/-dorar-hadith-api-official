import { normalizeResearchQuery } from "./rechercher-omega-query-normalizer.js";
import { verifyEvidenceGate } from "./rechercher-omega-evidence-gate.js";
import { resolveEvidenceConflicts } from "./rechercher-omega-conflict-resolution.js";

export async function runEvidenceFirstResearch({ provider, query, evidence = [], citations = [], claims = [], messages = [] } = {}) {
  if (!provider || typeof provider.generate !== "function") throw new TypeError("provider.generate is required");
  const normalized = normalizeResearchQuery(query);
  const conflicts = resolveEvidenceConflicts(claims);
  const verification = verifyEvidenceGate({ answer: "", evidence, citations, strict: true });
  const generated = await provider.generate({ messages, query: normalized.normalized });
  return Object.freeze({
    query: normalized,
    conflicts,
    verification,
    result: generated,
    corpusWrite: false,
    generatedMediaIsEvidence: false
  });
}
