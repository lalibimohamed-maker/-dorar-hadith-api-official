const FULL_DISTRIBUTION_RIGHTS = new Set(["redistributable", "licensed", "public-domain"]);
const READER_ALLOWED_RIGHTS = new Set(["redistributable", "licensed", "public-domain", "read-copy", "read-only"]);
const READER_ONLY = new Set(["read-copy", "read-only", "link-only"]);
const BLOCKED_RIGHTS = new Set(["restricted", "rights-unclear", "unknown"]);

export const QURAN_POLICY = Object.freeze({
  arabicText: "canonical-arabic-source",
  translationMode: "meaning-translation-below-arabic",
  neverReplaceArabicWithTranslation: true
});

export function resolveRequestedLanguage({ browserLanguage, requestedLanguage } = {}) {
  return requestedLanguage || browserLanguage || "ar";
}

function isRestricted(status) {
  return BLOCKED_RIGHTS.has(status);
}

export function buildBookDeliveryPolicy({
  rights,
  sourceAllowsReading = false,
  sourceAllowsCopy = false,
  language
} = {}) {
  const status = rights?.status;
  const explicitSourceRead = sourceAllowsReading === true;
  const explicitSourceCopy = sourceAllowsCopy === true;
  const fullDistribution = FULL_DISTRIBUTION_RIGHTS.has(status);
  const rightsPermitReader = READER_ALLOWED_RIGHTS.has(status);
  const blocked = isRestricted(status);

  const canRead = !blocked && (fullDistribution || rightsPermitReader || explicitSourceRead);
  const canCopyText = !blocked && (
    fullDistribution ||
    status === "read-copy" ||
    (explicitSourceCopy && explicitSourceRead)
  );
  const canDownloadDigitalMaster = !blocked && fullDistribution;

  return Object.freeze({
    language: resolveRequestedLanguage(language || {}),
    canRead,
    canCopyText,
    canDownloadDigitalMaster,
    canProvideSourceLink: READER_ONLY.has(status) || !canRead,
    mode: fullDistribution
      ? "digital-master"
      : canRead
        ? "reader-only"
        : "source-link",
    permissions: Object.freeze({
      reading: canRead,
      copyText: canCopyText,
      fullRedistribution: canDownloadDigitalMaster
    })
  });
}

export function canReadBook({ rights, sourceAllowsReading = false } = {}) {
  return buildBookDeliveryPolicy({ rights, sourceAllowsReading }).canRead;
}

export function canCopyBookText({
  rights,
  sourceAllowsReading = false,
  sourceAllowsCopy = false
} = {}) {
  return buildBookDeliveryPolicy({
    rights,
    sourceAllowsReading,
    sourceAllowsCopy
  }).canCopyText;
}

export function canRedistributeBook({ rights } = {}) {
  return !isRestricted(rights?.status) && FULL_DISTRIBUTION_RIGHTS.has(rights?.status);
}
