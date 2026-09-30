import { normalizeResearchQuery } from "./rechercher-omega-query-normalizer.js";
import { verifyAgentAnswer } from "./rechercher-omega-answer-verifier.js";
import { resolveEvidenceConflicts } from "./rechercher-omega-conflict-resolution.js";
import { applyEvidenceHardGate } from "./omega-evidence-runtime.js";

export async function runEvidenceFirstResearch({
  provider,
  query,
  evidence = [],
  citations = [],
  claims = [],
  claimProvenance = [],
  retriever = null,
  messages = []
} = {}) {
  if (!provider || typeof provider.generate !== "function") throw new TypeError("provider.generate is required");

  const normalized = normalizeResearchQuery(query);
  const conflicts = resolveEvidenceConflicts(claims);

  let retrieved = Array.isArray(evidence) ? evidence : [];
  if (!retrieved.length && retriever && typeof retriever.search === "function") {
    retrieved = await retriever.search(normalized.normalized, { topK: 10 });
  }

  if (!Array.isArray(retrieved) || retrieved.length === 0) {
    const verification = verifyAgentAnswer({answer:"", evidence:[], citations:[], claimProvenance});
    return Object.freeze({
      query: normalized,
      conflicts,
      retrievedEvidence: [],
      hardGate: {accepted:[],rejected:[]},
      verification,
      result: null,
      fallback: null,
      corpusWrite: false,
      generatedMediaIsEvidence: false
    });
  }

  const hardGate = applyEvidenceHardGate(retrieved);
  if (hardGate.accepted.length === 0) {
    const verification = verifyAgentAnswer({answer:"", evidence:[], citations:[], claimProvenance});
    return Object.freeze({
      query: normalized,
      conflicts,
      retrievedEvidence: [],
      hardGate,
      verification,
      result: null,
      fallback: null,
      corpusWrite: false,
      generatedMediaIsEvidence: false
    });
  }

  retrieved = hardGate.accepted;

  let generated;
  try {
    generated = await provider.generate({
      messages,
      query: normalized.normalized,
      evidence: retrieved
    });
  } catch (error) {
    return Object.freeze({
      query: normalized,
      conflicts,
      retrievedEvidence: retrieved,
      hardGate,
      verification: {
        verified:false,
        verification:null,
        claimVerification:null,
        fallback:null,
        error:{code:"MODEL_EXECUTION_FAILED",message:error.message}
      },
      result: null,
      fallback: retrieved.find(item=>item?.text)?.text ?? retrieved.find(item=>item?.text_raw)?.text_raw ?? null,
      corpusWrite: false,
      generatedMediaIsEvidence: false
    });
  }

  const answer = generated?.text ?? "";
  const trustedClaimProvenance = Array.isArray(claimProvenance) ? claimProvenance : [];
  const verification = verifyAgentAnswer({
    answer,
    evidence:retrieved,
    citations,
    claimProvenance:trustedClaimProvenance
  });

  return Object.freeze({
    query: normalized,
    conflicts,
    retrievedEvidence: retrieved,
    hardGate,
    verification,
    result: verification.verified ? generated : null,
    fallback: verification.verified ? null : verification.fallback,
    corpusWrite: false,
    generatedMediaIsEvidence: false
  });
}
