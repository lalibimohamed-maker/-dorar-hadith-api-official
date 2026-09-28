const REDISTRIBUTION_RIGHTS = new Set(["redistributable", "licensed", "public-domain"]);
const READER_ONLY = new Set(["read-only", "read-copy", "link-only"]);
const DEFAULT_FORMATS = Object.freeze(["pdf", "docx", "epub"]);

export const QURAN_POLICY = Object.freeze({
  arabicText: "canonical-arabic-source",
  translationMode: "meaning-translation-below-arabic",
  neverReplaceArabicWithTranslation: true,
  translationMetadataRequired: true,
  recitationLanguage: "ar"
});

export const READER_PIPELINE = Object.freeze([
  "book-discovery",
  "edition-resolution",
  "provenance",
  "rights",
  "validation",
  "digital-processing"
]);

export function resolveRequestedLanguage({ browserLanguage, requestedLanguage, defaultLanguage = "ar" } = {}) {
  return requestedLanguage || browserLanguage || defaultLanguage;
}

export function normalizeSupportedFormats(formats = DEFAULT_FORMATS) {
  return [...new Set(formats.map((format) => String(format).toLowerCase()))]
    .filter((format) => DEFAULT_FORMATS.includes(format));
}

export function buildBookDeliveryPolicy({
  rights,
  sourceAllowsReading = false,
  sourceAllowsCopy = false,
  language = {},
  provenanceVerified = false,
  validationPassed = false,
  supportedFormats = DEFAULT_FORMATS
} = {}) {
  const status = rights?.status;
  const redistributable = REDISTRIBUTION_RIGHTS.has(status);
  const readerOnly = READER_ONLY.has(status);
  const canRead = redistributable || (readerOnly && sourceAllowsReading);
  const canCopyText = redistributable || (readerOnly && sourceAllowsCopy);
  const formats = normalizeSupportedFormats(supportedFormats);
  const digitalMasterEligible = redistributable && provenanceVerified && validationPassed;

  return Object.freeze({
    language: resolveRequestedLanguage(language),
    pipeline: READER_PIPELINE,
    rightsStatus: status || "unknown",
    canRead,
    canCopyText,
    canDownloadDigitalMaster: digitalMasterEligible,
    canProvideSourceLink: !canRead || readerOnly,
    digitalMasterReady: digitalMasterEligible,
    downloadableFormats: digitalMasterEligible ? formats : [],
    mode: digitalMasterEligible ? "digital-master" : canRead ? "reader-only" : "source-link",
    distinction: "Reading Representation != Redistribution Master"
  });
}

export function buildQuranReadingRepresentation({
  arabicText,
  translation = null,
  translationLanguage = null,
  translationSource = null
} = {}) {
  if (!arabicText) throw new Error("Quran reading representation requires canonical Arabic text");
  return Object.freeze({
    arabicText,
    translation: translation || null,
    translationLanguage: translation ? translationLanguage || null : null,
    translationSource: translation ? translationSource || null : null,
    policy: QURAN_POLICY
  });
}
