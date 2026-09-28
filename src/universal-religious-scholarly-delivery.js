const APPROVED_REUSE = new Set(["redistributable", "licensed", "public-domain"]);
const COMPARATIVE = "comparative-critical";

export const CONTENT_SCOPE = Object.freeze({
  IN_SCOPE: "din-allah-religious-scholarly",
  OUT_OF_SCOPE: "general-world-books"
});

export const DELIVERY_PIPELINE = Object.freeze([
  "user-query",
  "language-resolution",
  "book-discovery-across-sources",
  "edition-resolution",
  "rights",
  "provenance",
  "multi-ocr",
  "quality-control",
  "digital-master",
  "reader-download"
]);

export function classifyBookForDelivery({
  domain,
  sourceClass = "approved",
  rights = {},
  quran = false
} = {}) {
  if (quran) {
    return Object.freeze({
      scope: CONTENT_SCOPE.IN_SCOPE,
      eligible: true,
      trustedCorpus: true,
      comparativeOnly: false,
      quranSpecialPolicy: true,
      sourceClass,
      rightsStatus: rights.status ?? "unknown"
    });
  }

  if (domain !== CONTENT_SCOPE.IN_SCOPE) {
    return Object.freeze({
      scope: CONTENT_SCOPE.OUT_OF_SCOPE,
      eligible: false,
      trustedCorpus: false,
      comparativeOnly: false,
      quranSpecialPolicy: false,
      sourceClass,
      rightsStatus: rights.status ?? "unknown"
    });
  }

  const comparativeOnly = sourceClass === COMPARATIVE;
  const approvedSource = sourceClass !== "unapproved" && !comparativeOnly;

  return Object.freeze({
    scope: CONTENT_SCOPE.IN_SCOPE,
    eligible: approvedSource,
    trustedCorpus: approvedSource,
    comparativeOnly,
    quranSpecialPolicy: false,
    sourceClass,
    redistributable: APPROVED_REUSE.has(rights.status),
    rightsStatus: rights.status ?? "unknown"
  });
}

export function buildReligiousScholarlyDeliveryPlan({
  domain,
  sourceClass = "approved",
  rights = {},
  provenance = {},
  validation = {},
  ocr = {},
  quran = false,
  browserLanguage,
  requestedLanguage
} = {}) {
  const classification = classifyBookForDelivery({ domain, sourceClass, rights, quran });
  const language = requestedLanguage || browserLanguage || "ar";
  const rightsApproved = APPROVED_REUSE.has(rights.status);
  const provenanceVerified = provenance.verified === true;
  const qualityControlled = validation.status === "passed" && ocr.status === "aligned";
  const digitalMasterEligible = classification.eligible &&
    classification.trustedCorpus &&
    rightsApproved &&
    provenanceVerified &&
    qualityControlled &&
    !classification.comparativeOnly;

  return Object.freeze({
    pipeline: DELIVERY_PIPELINE,
    language,
    languageSource: requestedLanguage ? "explicit-request" : browserLanguage ? "browser" : "default",
    classification,
    rightsStatus: rights.status ?? "unknown",
    provenanceVerified,
    multiOcrStatus: ocr.status ?? "pending",
    qualityControlStatus: validation.status ?? "pending",
    digitalMasterEligible,
    readerMode: digitalMasterEligible
      ? "digital-master"
      : classification.comparativeOnly || classification.eligible
        ? "reader/source-reference"
        : "not-in-scope",
    downloadFormats: digitalMasterEligible ? ["pdf", "docx", "epub"] : [],
    copyTextRequiresSourcePermission: true,
    readingRepresentationDistinctFromRedistributionMaster: true
  });
}
