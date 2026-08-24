const EXPORTABLE = new Set(["redistributable", "licensed", "public-domain"]);
const READER_ONLY = new Set(["read-only", "link-only"]);

export const QURAN_POLICY = Object.freeze({
  arabicText: "canonical-arabic-source",
  translationMode: "meaning-translation-below-arabic",
  neverReplaceArabicWithTranslation: true
});

export function resolveRequestedLanguage({ browserLanguage, requestedLanguage }) {
  return requestedLanguage || browserLanguage || "ar";
}

export function buildBookDeliveryPolicy({ rights, sourceAllowsReading = false, sourceAllowsCopy = false, language }) {
  const status = rights?.status;
  const exportable = EXPORTABLE.has(status);
  const readerOnly = READER_ONLY.has(status);
  const canRead = exportable || (readerOnly && sourceAllowsReading);
  const canCopyText = exportable || (readerOnly && sourceAllowsCopy);

  return Object.freeze({
    language: resolveRequestedLanguage(language || {}),
    canRead,
    canCopyText,
    canDownloadDigitalMaster: exportable,
    canProvideSourceLink: readerOnly || !canRead,
    mode: exportable ? "digital-master" : canRead ? "reader-only" : "source-link"
  });
}
