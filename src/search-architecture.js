import contract from "../config/search-architecture-contract-2026.json" with { type: "json" };

const CATEGORY_IDS = new Set(contract.categories.map((item) => item.id));
const TYPE_TO_CATEGORY = new Map([
  ["quran_ayah", "quran"], ["quran_word", "quran"], ["translation", "quran"],
  ["tafsir_entry", "tafsir"], ["tadabbur", "tadabbur"],
  ["hadith", "hadith"], ["athar", "hadith"],
  ["musnad", "musnads-sunan"], ["sunan", "musnads-sunan"],
  ["sirah", "sirah"], ["maghazi", "sirah"], ["shamail", "sirah"],
  ["fiqh", "fiqh"], ["fiqh_ruling", "fiqh"], ["fiqh_issue", "fiqh"],
  ["usul_al_fiqh", "usul-fiqh"], ["legal_maxim", "usul-fiqh"],
  ["maqasid", "maqasid"], ["aqidah", "aqidah"],
  ["biography", "biographies"], ["rijal", "biographies"], ["scholarly_opinion", "biographies"],
  ["book", "library"], ["book_section", "library"], ["research", "library"], ["history", "sirah"], ["maghazi", "sirah"], ["companions", "biographies"], ["genealogy", "biographies"]
]);

function clean(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

export function getSearchArchitectureContract() {
  return structuredClone(contract);
}

export function listSearchCategories() {
  return contract.categories.map((item) => ({ ...item }));
}

export function classifySearchResult(record = {}) {
  const requested = clean(record.domain || record.topic || record.category);
  if (requested && CATEGORY_IDS.has(requested)) return requested;
  const type = clean(record.type || record.sourceType);
  if (type && TYPE_TO_CATEGORY.has(type)) return TYPE_TO_CATEGORY.get(type);
  return "library";
}

function bibliographic(record) {
  const bib = record.bibliographic || {};
  const fields = ["author","work","edition","publisher","year","volume","page","chapter","locator"];
  const out = {};
  for (const field of fields) {
    const value = bib[field] ?? record[field];
    if (value !== null && value !== undefined && String(value).trim() !== "") out[field] = value;
  }
  return Object.keys(out).length ? out : null;
}

export function buildSourceEnvelope(record = {}) {
  const sourceId = clean(record.sourceId || record.providerId || record.source_id);
  const sourceType = clean(record.sourceType || record.sourceKind || record.type) || "source-record";
  const source = clean(record.source || record.sourceUrl || record.url);
  return {
    sourceId,
    sourceType,
    source,
    bibliographic: bibliographic(record),
    verificationState: clean(record.verificationState || record.verification || record.reviewStatus) || "unverified",
    rightsState: clean(record.rightsState || record.rights) || "unknown",
  };
}

export function normalizeSearchResult(record = {}) {
  const envelope = buildSourceEnvelope(record);
  return {
    ...record,
    domain: classifySearchResult(record),
    sourceId: envelope.sourceId,
    sourceType: envelope.sourceType,
    source: envelope.source,
    bibliographic: envelope.bibliographic,
    verificationState: envelope.verificationState,
    rightsState: envelope.rightsState,
    sourceEnvelope: envelope,
  };
}

export function normalizeHadithEvidence(item = {}) {
  const rawGrade = item.grading ?? item.grade ?? item.hukm ?? null;
  const grading = rawGrade ? { value: clean(rawGrade), reportedBy: clean(item.gradingSource || item.grader || item.grading_source) } : { value: null, reportedBy: null, status: "not-reported" };
  const source = {
    collection: clean(item.collection || item.book || item.source),
    chapter: clean(item.chapter),
    hadithNumber: item.hadithNumber ?? item.number ?? null,
    sourceUrl: clean(item.sourceUrl || item.url),
  };
  return {
    ...item,
    type: "hadith",
    domain: "hadith",
    sourceEvidence: source,
    gradingEvidence: grading,
    policy: {
      collectionDoesNotCertifyAuthenticity: true,
      gradingMustRemainSourceBound: true,
      absentGradeIsNotInferred: true,
    },
  };
}

export function normalizeRevelationLink(item = {}) {
  const relation = clean(item.type || item.relation || item.relationshipType) || "candidate";
  const confidence = clean(item.confidence) || "unverified";
  const isCause = relation === "revelation-cause" || relation === "sabab-al-nuzul" || relation === "cause-of-revelation";
  const verified = confidence === "verified";
  return {
    ...item,
    relation,
    confidence,
    promotionState: isCause && verified ? "verified-cause" : isCause ? "candidate-cause" : "context-or-related",
    policy: {
      thematicSimilarityDoesNotProveCause: true,
      weakReportsRemainLabeled: true,
      weakOrDisputedCannotBePromotedToFact: true,
    },
  };
}

export function evaluateRecitationSync({ rightsVerified = false, wordTimings = [], ayahTiming = false } = {}) {
  const wordLevel = rightsVerified && Array.isArray(wordTimings) && wordTimings.length > 0;
  return {
    rightsVerified: Boolean(rightsVerified),
    mode: wordLevel ? "word" : ayahTiming ? "ayah" : "none",
    wordHighlighting: wordLevel,
    ayahSynchronization: Boolean(wordLevel || ayahTiming),
    downloadAllowed: Boolean(rightsVerified),
    offlineAllowed: Boolean(rightsVerified),
    fallbackReason: wordLevel ? null : (ayahTiming ? "no-trusted-word-level-timing" : "no-authorized-timing-data"),
  };
}

export function evaluateLibraryAccess({ format, rightsStatus, sourcePermission = false, licenseAllowsRedistribution = false } = {}) {
  const normalizedFormat = clean(format)?.toLowerCase() || null;
  const eligibleFormat = ["pdf", "docx"].includes(normalizedFormat);
  const redistributable = ["redistributable", "licensed", "public-domain", "verified-redistributable"].includes(clean(rightsStatus)) || licenseAllowsRedistribution;
  return {
    format: normalizedFormat,
    indexed: eligibleFormat,
    canDownload: eligibleFormat && (sourcePermission || redistributable),
    canRedistribute: eligibleFormat && redistributable,
    fallback: eligibleFormat && !(sourcePermission || redistributable) ? "source-link-only" : null,
    neverRepublishMerelyBecauseOnline: true,
  };
}

export const SEARCH_ARCHITECTURE_POLICY = Object.freeze({
  sourceAttributionRequired: true,
  discoveryIsNotAuthority: true,
  hadithCollectionIsNotAuthentication: true,
  causeOfRevelationRequiresVerifiedSource: true,
  fiqhSchools: contract.fiqh.madhahib.map((item) => item.id),
  maqasidParent: contract.maqasid.parent.id,
  maqasidDaruriyyat: contract.maqasid.daruriyyat.map((item) => item.id),
  libraryDownloadIsRightsGated: true,
  recitationWordSyncIsTimingAndRightsGated: true,
  corpusImmutable: true,
});