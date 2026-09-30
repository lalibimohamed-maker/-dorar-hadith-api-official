import { normalizeResearchQuery } from "./rechercher-omega-query-normalizer.js";
import { verifyAgentAnswer } from "./rechercher-omega-answer-verifier.js";
import { resolveEvidenceConflicts } from "./rechercher-omega-conflict-resolution.js";

export async function runEvidenceFirstResearch({ provider, query, evidence = [], citations = [], claims = [], messages = [] } = {}) {
  if (!provider || typeof provider.generate !== "function") throw new TypeError("provider.generate is required");
  const normalized = normalizeResearchQuery(query);
  const conflicts = resolveEvidenceConflicts(claims);

  if (!Array.isArray(evidence) || evidence.length === 0) {
    const verification = verifyAgentAnswer({answer:"", evidence, citations});
    return Object.freeze({query:normalized, conflicts, verification, result:null, fallback:null, corpusWrite:false, generatedMediaIsEvidence:false});
  }

  const generated = await provider.generate({ messages, query: normalized.normalized });
  const verification = verifyAgentAnswer({answer: generated?.text ?? "", evidence, citations});

  if (!verification.verified) {
    return Object.freeze({
      query: normalized,
      conflicts,
      verification,
      result: null,
      fallback: verification.fallback,
      corpusWrite: false,
      generatedMediaIsEvidence: false
    });
  }

  return Object.freeze({
    query: normalized,
    conflicts,
    verification,
    result: generated,
    fallback: null,
    corpusWrite: false,
    generatedMediaIsEvidence: false
  });
}
