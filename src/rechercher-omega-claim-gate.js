import { createHash } from "node:crypto";
import { canonicalArabicText } from "./rechercher-omega-arabic-integrity.js";

export const UNSUPPORTED_CLAIM_GATE_VERSION = "1.0.0";

const CLAIM_BOUNDARY = /[.!?؟\n]+/u;
const SCHOLARLY_MARKERS = [
  "يجوز","يحرم","حكم","واجب","فرض","سنة","مندوب","مكروه","حرام",
  "تفسير","معنى","يدل","دليل","استدلال","استنباط","العلماء",
  "الفقه","الفقهي","العقيدة","العقدي","الحديث","صحيح","حسن",
  "ضعيف","مرفوع","موقوف","ناسخ","منسوخ","سبب النزول","قاعدة"
];

function sha256(value) {
  return createHash("sha256")
    .update(String(value ?? ""), "utf8")
    .digest("hex");
}

function normalizeClaimText(value) {
  return canonicalArabicText(String(value ?? ""))
    .replace(/\s+/gu, " ")
    .trim();
}

function splitSentences(value) {
  return String(value ?? "")
    .split(CLAIM_BOUNDARY)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isQuotedSourceSentence(sentence, evidence) {
  const normalizedSentence = normalizeClaimText(sentence);
  if (!normalizedSentence) return false;

  return evidence.some((item) => {
    const source = normalizeClaimText(item?.text ?? item?.text_raw ?? "");
    if (!source) return false;
    return normalizedSentence.includes(source);
  });
}

function isScholarlyClaim(sentence) {
  const normalized = normalizeClaimText(sentence);
  if (normalized.length < 8) return false;

  if (SCHOLARLY_MARKERS.some((marker) => normalized.includes(marker))) {
    return true;
  }

  // Conservative declarative fallback: do not treat greetings/questions/labels as claims.
  if (/^(?:هل|ما|ماذا|كيف|أين|متى|من)\\b/u.test(normalized)) return false;
  if (/^(?:نعم|لا|حسنًا|إليك|إجابة|ملاحظة|تنبيه|السؤال)\\b/u.test(normalized)) return false;

  return normalized.length >= 40 && /(?:هو|هي|هذا|هذه|ذلك|تلك|إن|إنّ|أن|لأن|لذلك|فإن|وقد|ويكون|وتكون)/u.test(normalized);
}

function sourceKey(id, citation) {
  return String(id ?? "") + "|" + String(citation ?? "");
}

function validateProvenanceRecord(record) {
  if (!record || record.verification_status !== "verified") return null;

  const claimText = normalizeClaimText(record.claim_text ?? record.statement);
  const claimHash = String(record.claim_sha256 ?? "");
  if (!claimText || !/^[a-f0-9]{64}$/i.test(claimHash)) return null;
  if (sha256(claimText) !== claimHash.toLowerCase()) return null;

  const citations = Array.isArray(record.citations) ? record.citations : [];
  const evidenceIds = Array.isArray(record.evidence_ids) ? record.evidence_ids.map(String) : [];

  return {
    claimText,
    claimSha256: claimHash.toLowerCase(),
    supportType: record.support_type ?? "knowledge_graph",
    supportId: record.support_id ?? record.relation_id ?? null,
    evidenceIds,
    citations: citations.map((citation) => ({
      sourceId: citation?.sourceId ?? citation?.source_id ?? null,
      citation: citation?.citation ?? null,
      text_hash: citation?.text_hash ?? null
    })).filter((citation) => citation.sourceId && citation.citation)
  };
}

export class UnsupportedClaimGate {
  static verifyClaimCoverage(
    assistantOutput,
    retrievedEvidenceNodes = [],
    claimProvenance = []
  ) {
    if (typeof assistantOutput !== "string") {
      throw new TypeError("assistantOutput must be a string");
    }
    if (!Array.isArray(retrievedEvidenceNodes)) {
      throw new TypeError("retrievedEvidenceNodes must be an array");
    }
    if (!Array.isArray(claimProvenance)) {
      throw new TypeError("claimProvenance must be an array");
    }

    const normalizedEvidence = retrievedEvidenceNodes.map((item) => ({
      sourceId: item?.sourceId ?? item?.source_id ?? item?.id ?? null,
      citation: item?.citation ?? item?.provenance?.citation ?? null
    }));

    const evidenceKeys = new Set(
      normalizedEvidence
        .filter((item) => item.sourceId && item.citation)
        .map((item) => sourceKey(item.sourceId, item.citation))
    );

    const provenanceByHash = new Map();
    for (const record of claimProvenance) {
      const normalized = validateProvenanceRecord(record);
      if (normalized) provenanceByHash.set(normalized.claimSha256, normalized);
    }

    const sentences = splitSentences(assistantOutput);
    const claims = [];
    const rejected = [];

    for (const sentence of sentences) {
      if (isQuotedSourceSentence(sentence, retrievedEvidenceNodes)) continue;
      if (!isScholarlyClaim(sentence)) continue;

      const claimText = normalizeClaimText(sentence);
      const claimSha256 = sha256(claimText);
      const provenance = provenanceByHash.get(claimSha256);

      if (!provenance) {
        rejected.push({
          claim: sentence,
          claim_sha256: claimSha256,
          reason: "UNSUPPORTED_CLAIM"
        });
        continue;
      }

      const coveredByEvidence = provenance.citations.length > 0
        ? provenance.citations.every((citation) =>
            evidenceKeys.has(sourceKey(citation.sourceId, citation.citation))
          )
        : provenance.evidenceIds.length > 0 &&
          provenance.evidenceIds.every((id) =>
            normalizedEvidence.some((item) => String(item.sourceId) === id)
          );

      if (!coveredByEvidence) {
        rejected.push({
          claim: sentence,
          claim_sha256: claimSha256,
          reason: "CLAIM_CITATION_OUTSIDE_EVIDENCE"
        });
        continue;
      }

      claims.push({
        claim: sentence,
        claim_sha256: claimSha256,
        support_type: provenance.supportType,
        support_id: provenance.supportId,
        evidence_ids: provenance.evidenceIds,
        citations: provenance.citations
      });
    }

    if (rejected.length > 0) {
      return Object.freeze({
        ok: false,
        version: UNSUPPORTED_CLAIM_GATE_VERSION,
        claim_count: claims.length + rejected.length,
        covered_claim_count: claims.length,
        rejected_claim_count: rejected.length,
        claims,
        rejected
      });
    }

    return Object.freeze({
      ok: true,
      version: UNSUPPORTED_CLAIM_GATE_VERSION,
      claim_count: claims.length,
      covered_claim_count: claims.length,
      rejected_claim_count: 0,
      claims,
      rejected: []
    });
  }
}
