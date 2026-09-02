/**
 * @Rechercher access policy.
 *
 * A restricted/unproven work may be presented in an in-browser study viewer
 * without turning the source file into a downloadable mirror. Selection/copy
 * of ordinary text is intentionally allowed for study; bulk export, source
 * PDF download, and unrestricted API delivery remain disabled.
 *
 * Language availability is source-specific. A translation is its own edition
 * and must carry its own provenance/rights decision. Machine translation is
 * clearly labelled and never treated as the authoritative source text.
 */

export const ACCESS_MODES = Object.freeze({
  FULL: "full",
  READ_ONLY: "read-only",
  LINK_ONLY: "link-only",
  BLOCKED: "blocked"
});

export const TRANSLATION_MODES = Object.freeze({
  SOURCE: "source",
  LICENSED_TRANSLATION: "licensed-translation",
  PUBLIC_DOMAIN_TRANSLATION: "public-domain-translation",
  MACHINE_TRANSLATION: "machine-translation",
  UNAVAILABLE: "unavailable"
});

const READABLE_DECISIONS = new Set([
  "redistributable",
  "explicitly-licensed",
  "underlying-work-public-domain-edition-needs-review",
  "underlying-work-protected",
  "read-only"
]);

const BLOCKED_DECISIONS = new Set(["conflict", "unclear", "link-only"]);

export function resolveAccess(rightsDecision, options = {}) {
  const allowStudyViewer = options.allowStudyViewer !== false;
  if (rightsDecision === "redistributable" || rightsDecision === "explicitly-licensed") {
    return {
      mode: ACCESS_MODES.FULL,
      view: true,
      selectable: true,
      copy: true,
      download: options.allowDownload === true,
      bulkExport: false
    };
  }

  if (allowStudyViewer && READABLE_DECISIONS.has(rightsDecision)) {
    return {
      mode: ACCESS_MODES.READ_ONLY,
      view: true,
      selectable: true,
      copy: true,
      download: false,
      bulkExport: false
    };
  }

  if (BLOCKED_DECISIONS.has(rightsDecision)) {
    return {
      mode: ACCESS_MODES.READ_ONLY,
      view: allowStudyViewer,
      selectable: allowStudyViewer,
      copy: allowStudyViewer,
      download: false,
      bulkExport: false,
      reason: "rights-not-proven-or-conflicted"
    };
  }

  return {
    mode: ACCESS_MODES.BLOCKED,
    view: false,
    selectable: false,
    copy: false,
    download: false,
    bulkExport: false
  };
}

export function chooseLanguageEdition(book, requestedLanguage = "ar") {
  const language = String(requestedLanguage || "ar").toLowerCase();
  const editions = Array.isArray(book?.languageEditions) ? book.languageEditions : [];

  const exact = editions.find(e =>
    String(e.language || "").toLowerCase() === language &&
    ["redistributable", "explicitly-licensed", "read-only"].includes(e.rightsDecision)
  );
  if (exact) {
    return {
      language,
      mode: exact.translationOf ?
        (exact.translationMode || TRANSLATION_MODES.LICENSED_TRANSLATION) :
        TRANSLATION_MODES.SOURCE,
      edition: exact,
      authoritative: exact.translationOf ? exact.authoritative !== false : true
    };
  }

  if (String(book?.language || "").toLowerCase() === language) {
    return {
      language,
      mode: TRANSLATION_MODES.SOURCE,
      edition: book,
      authoritative: true
    };
  }

  return {
    language,
    mode: TRANSLATION_MODES.UNAVAILABLE,
    edition: null,
    authoritative: false
  };
}

export function buildStudyViewerPolicy(record, requestedLanguage = "ar") {
  const access = resolveAccess(record?.rightsDecision);
  const language = chooseLanguageEdition(record, requestedLanguage);
  return {
    access,
    language,
    controls: {
      textSelection: access.selectable,
      copySelectedText: access.copy,
      downloadOriginal: access.download,
      bulkExport: false,
      print: false
    },
    sourceLink: record?.sourceUrl || record?.sourcePage || null,
    rightsDecision: record?.rightsDecision || "unclear"
  };
}
