export const QURAN_KNOWLEDGE_TRACKS = Object.freeze([
  "tafsir",
  "tadabbur",
  "visual-learning",
]);

export const QURAN_BASE_LAYER = "quran-text";

const ALLOWED_RIGHTS = new Set([
  "redistributable",
  "licensed",
  "public-domain",
]);

const REQUIRED_FIELDS = Object.freeze([
  "workId",
  "contentLayer",
  "title",
  "sourceRef",
  "sourceTier",
  "status",
  "rights",
  "ingestion",
  "provenance",
  "scientificRole",
]);

export function isQuranKnowledgeTrack(value) {
  return QURAN_KNOWLEDGE_TRACKS.includes(value);
}

export function classifyQuranKnowledgeLayer(work = {}) {
  if (work.contentLayer === QURAN_BASE_LAYER) {
    return {
      layer: QURAN_BASE_LAYER,
      allowed: true,
      authoritative: true,
      reason: "Canonical Quran text remains separate from derived knowledge works.",
    };
  }

  if (!isQuranKnowledgeTrack(work.contentLayer)) {
    return {
      layer: null,
      allowed: false,
      authoritative: false,
      reason: "Unknown Quran knowledge layer; fail closed.",
    };
  }

  if (work.contentLayer === "tafsir" && work.scientificRole !== "tafsir-of-quran") {
    return {
      layer: "tafsir",
      allowed: false,
      authoritative: false,
      reason: "Tafsir records must remain classified as tafsir.",
    };
  }

  if (work.contentLayer === "tadabbur" && work.scientificRole !== "tadabbur-and-hidayat") {
    return {
      layer: "tadabbur",
      allowed: false,
      authoritative: false,
      reason: "Tadabbur records must remain classified as tadabbur/hidayat.",
    };
  }

  if (work.contentLayer === "visual-learning" && work.scientificRole !== "visual-learning-aid") {
    return {
      layer: "visual-learning",
      allowed: false,
      authoritative: false,
      reason: "Visual records must remain classified as visual-learning aids.",
    };
  }

  return {
    layer: work.contentLayer,
    allowed: true,
    authoritative: false,
    reason: "Derived Quran-knowledge work.",
  };
}

export function validateQuranKnowledgeWork(work = {}) {
  const missing = REQUIRED_FIELDS.filter(field => work[field] == null);
  if (missing.length) {
    return { valid: false, missing };
  }

  const classification = classifyQuranKnowledgeLayer(work);
  if (!classification.allowed) {
    return { valid: false, reason: classification.reason };
  }

  if (!work.title.trim?.()) {
    return { valid: false, reason: "title_required" };
  }

  if (!work.sourceRef) {
    return { valid: false, reason: "source_required" };
  }

  if (work.rights?.status !== "not_verified" && !ALLOWED_RIGHTS.has(work.rights?.status)) {
    return { valid: false, reason: "invalid_rights_status" };
  }

  return {
    valid: true,
    layer: classification.layer,
    authoritative: classification.authoritative,
  };
}

export function canIngestQuranKnowledgeFullText(work = {}) {
  const validation = validateQuranKnowledgeWork(work);
  if (!validation.valid) return { allowed: false, reason: "work_record_invalid", validation };

  const provenance = work.provenance;
  const provenanceComplete =
    provenance?.authorVerified === true &&
    provenance?.titleVerified === true &&
    provenance?.sourceVerified === true &&
    (provenance?.editionVerified === true || work.edition == null) &&
    provenance?.checkedAt;

  if (!provenanceComplete) {
    return {
      allowed: false,
      reason: "provenance_not_complete",
      validation,
    };
  }

  if (!ALLOWED_RIGHTS.has(work.rights?.status) || work.rights?.redistributionAllowed !== true) {
    return {
      allowed: false,
      reason: "redistribution_rights_not_verified",
      validation,
    };
  }

  if (work.ingestion?.verifiedAt == null || work.ingestion?.method == null) {
    return {
      allowed: false,
      reason: "ingestion_verification_required",
      validation,
    };
  }

  if (!["valid", "passed"].includes(work.ingestion?.validationStatus)) {
    return {
      allowed: false,
      reason: "file_validation_required",
      validation,
    };
  }

  return {
    allowed: true,
    reason: "source_provenance_rights_and_validation_verified",
    validation,
  };
}

export function buildQuranKnowledgeProvenance({
  work,
  authorVerified = false,
  titleVerified = false,
  editionVerified = false,
  sourceVerified = false,
  checkedAt = null,
  rightsStatus = "not_verified",
  redistributionAllowed = false,
  ingestionMethod = null,
  ingestionVerifiedAt = null,
  ingestionValidationStatus = null,
} = {}) {
  if (!work?.workId) throw new Error("work.workId is required");

  return {
    workId: work.workId,
    contentLayer: work.contentLayer,
    author: work.author ?? null,
    title: work.title,
    edition: work.edition ?? null,
    sourceRef: work.sourceRef,
    sourceTier: work.sourceTier,
    rights: {
      status: rightsStatus,
      redistributionAllowed: Boolean(redistributionAllowed),
      evidence: null,
    },
    provenance: {
      authorVerified: Boolean(authorVerified),
      titleVerified: Boolean(titleVerified),
      editionVerified: Boolean(editionVerified),
      sourceVerified: Boolean(sourceVerified),
      checkedAt,
    },
    ingestion: {
      method: ingestionMethod,
      verifiedAt: ingestionVerifiedAt,
      validationStatus: ingestionValidationStatus,
      fullTextAllowed: false,
    },
  };
}
