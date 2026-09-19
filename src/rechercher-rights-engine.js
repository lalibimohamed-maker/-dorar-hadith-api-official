/**
 * @Rechercher — work/edition rights intelligence.
 *
 * This module deliberately separates:
 *   1) the underlying work,
 *   2) a particular edition/scan/translation, and
 *   3) the jurisdiction in which redistribution is planned.
 *
 * It never treats "free download" as a license and fails closed when
 * evidence conflicts or is insufficient.
 */

export const EDITION_TYPES = Object.freeze({
  ORIGINAL_WORK: "original-work",
  MANUSCRIPT: "manuscript",
  HISTORIC_SCAN: "historic-scan",
  PUBLIC_DOMAIN_SCAN: "public-domain-scan",
  MODERN_EDITION: "modern-edition",
  TRANSLATION: "translation",
  CRITICAL_EDITION: "critical-edition",
  UNKNOWN: "unknown"
});

export const RIGHTS_DECISIONS = Object.freeze({
  REDISTRIBUTABLE: "redistributable",
  WORK_PD_EDITION_REVIEW: "underlying-work-public-domain-edition-needs-review",
  WORK_PROTECTED: "underlying-work-protected",
  LICENSED: "explicitly-licensed",
  READ_ONLY: "read-only",
  LINK_ONLY: "link-only",
  UNCLEAR: "unclear",
  CONFLICT: "conflict"
});

export const JURISDICTIONS = Object.freeze({
  DZ: { code: "DZ", name: "Algeria", termYears: 50, source: "WIPO Lex — Ordinance 03-05, Article 54" },
  SA: { code: "SA", name: "Saudi Arabia", termYears: 50, source: "WIPO Lex — Saudi copyright law" },
  BERNE_BASELINE: { code: "BERNE_BASELINE", name: "Berne minimum baseline", termYears: 50, source: "WIPO — Berne Convention summary" }
});

const RIGHTS_PATTERNS = [
  { kind: "explicit-redistribution-permission", re: /(creative commons|cc[- ]by|cc[- ]by[- ]sa|cc0|public domain|public-domain|no known copyright restrictions|free to redistribute|redistribution permitted|may be redistributed|يجوز (?:نشر|توزيع|إعادة نشر|إعادة توزيع)|متاح لإعادة النشر|ملكية عامة)/iu },
  { kind: "copyright-reservation", re: /(all rights reserved|جميع الحقوق محفوظة|لا يسمح بإعادة|يمنع (?:النشر|إعادة النشر)|حقوق النشر محفوظة)/iu },
  { kind: "read-copy-permission", re: /(download|تحميل|تنزيل)/iu },
  { kind: "waqf", re: /(وقف لله|وقف لله تعالى|وقفية)/iu }
];

function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null && value !== "");
}

function normalizeYear(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  const match = text.match(/(?:^|\D)([12]\d{3})(?:\D|$)/);
  return match ? Number(match[1]) : null;
}

function hasAny(value) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

export function publicDomainByDeath(deathYear, jurisdiction = JURISDICTIONS.BERNE_BASELINE, asOfYear = new Date().getUTCFullYear()) {
  const y = normalizeYear(deathYear);
  const term = Number(jurisdiction?.termYears ?? 50);
  if (!Number.isInteger(y) || y <= 0 || !Number.isInteger(term) || term < 0) {
    return { known: false, publicDomain: false, reason: "missing-death-year-or-term" };
  }
  // For life+50 regimes counted from the next Gregorian year, protection
  // expires at the start of (deathYear + termYears + 1).
  const publicDomainYear = y + term + 1;
  return {
    known: true,
    publicDomain: publicDomainYear <= asOfYear,
    publicDomainYear,
    deathYear: y,
    termYears: term,
    jurisdiction: jurisdiction.code
  };
}

export function inferEditionType(record = {}) {
  const text = [record.editionType, record.format, record.notes, record.title, record.license, record.publisher]
    .filter(Boolean).join(" ").toLowerCase();
  if (/translation|ترجمة|مترجم/u.test(text)) return EDITION_TYPES.TRANSLATION;
  if (/critical|تحقيق|محقق|تحرير|تحرير علمي/u.test(text)) return EDITION_TYPES.CRITICAL_EDITION;
  if (/manuscript|مخطوط|مخطوطة/u.test(text)) return EDITION_TYPES.MANUSCRIPT;
  if (/scan|مصورة|مصور|طبعة قديمة|بولاق|السلفية القديمة/u.test(text)) return EDITION_TYPES.HISTORIC_SCAN;
  if (/pdf|book|print|طبعة|دار|ناشر|publisher/u.test(text)) return EDITION_TYPES.MODERN_EDITION;
  if (record.author && !record.editionYear && !record.publisher && !record.editor) return EDITION_TYPES.ORIGINAL_WORK;
  return EDITION_TYPES.UNKNOWN;
}

export function classifyEdition(record = {}, options = {}) {
  const jurisdiction = options.jurisdiction ?? JURISDICTIONS.BERNE_BASELINE;
  const asOfYear = options.asOfYear ?? new Date().getUTCFullYear();
  const editionType = inferEditionType(record);
  const work = publicDomainByDeath(record.authorDeathYear, jurisdiction, asOfYear);
  const explicitLicense = Boolean(record.explicitRedistribution || record.license && /(cc0|creative commons|public domain|open data)/iu.test(record.license));
  const blockingLicense = Boolean(record.restricted || record.noRedistribution || /(all rights reserved|جميع الحقوق محفوظة)/iu.test(record.license || ""));

  if (explicitLicense && !blockingLicense) {
    return { decision: RIGHTS_DECISIONS.LICENSED, editionType, workStatus: work, editionNeedsReview: false, reason: "explicit-reuse-license" };
  }
  if (blockingLicense) {
    return { decision: RIGHTS_DECISIONS.UNCLEAR, editionType, workStatus: work, editionNeedsReview: true, reason: "rights-reservation-or-restriction" };
  }
  if (!work.known) {
    return { decision: RIGHTS_DECISIONS.UNCLEAR, editionType, workStatus: work, editionNeedsReview: true, reason: "author-death-year-not-established" };
  }
  if (!work.publicDomain) {
    return { decision: RIGHTS_DECISIONS.WORK_PROTECTED, editionType, workStatus: work, editionNeedsReview: true, reason: "underlying-work-still-protected" };
  }
  const hasModernContributor = hasAny(record.editor) || hasAny(record.publisher) || normalizeYear(record.editionYear) >= 1960;
  if (hasModernContributor && ![EDITION_TYPES.HISTORIC_SCAN, EDITION_TYPES.MANUSCRIPT].includes(editionType)) {
    return {
      decision: RIGHTS_DECISIONS.WORK_PD_EDITION_REVIEW,
      editionType,
      workStatus: work,
      editionNeedsReview: true,
      reason: "public-domain-underlying-work-but-edition-may-contain-protected-editorial/layout/contribution"
    };
  }
  return { decision: RIGHTS_DECISIONS.REDISTRIBUTABLE, editionType, workStatus: work, editionNeedsReview: false, reason: "public-domain-work-and-no-modern-edition-barrier-detected" };
}

export function extractMetadataFromHtml(html = "") {
  const text = html.replace(/<script[\s\S]*?<\/script>/giu, " ").replace(/<style[\s\S]*?<\/style>/giu, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const getMeta = key => {
    const re = new RegExp(`<meta[^>]+(?:name|property)=[\"']${key}[\"'][^>]+content=[\"']([^\"']+)[\"']`, "iu");
    return html.match(re)?.[1] || null;
  };
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/iu)?.[1]?.replace(/\s+/g, " ").trim() || null;
  const author = firstDefined(getMeta("author"), getMeta("dc.creator"));
  const publisher = firstDefined(getMeta("publisher"), getMeta("dc.publisher"));
  const rights = firstDefined(getMeta("rights"), getMeta("dc.rights"), getMeta("license"));
  const signals = RIGHTS_PATTERNS.filter(x => x.re.test(text)).map(x => ({ kind: x.kind, excerpt: text.slice(Math.max(0, text.search(x.re) - 120), text.search(x.re) + 320) }));
  return { title, author, publisher, rights, text, rightsSignals: signals };
}

export function classifyRightsEvidence(evidence = []) {
  const valid = evidence.filter(e => e && typeof e === "object" && e.kind);
  const explicit = valid.some(e => e.kind === "explicit-redistribution-permission" || e.kind === "public-domain");
  const blocked = valid.some(e => ["no-redistribution", "copyright-reservation", "restricted"].includes(e.kind));
  if (explicit && blocked) return { decision: RIGHTS_DECISIONS.CONFLICT, confidence: 0, conflict: true };
  if (explicit) return { decision: RIGHTS_DECISIONS.REDISTRIBUTABLE, confidence: 1, conflict: false };
  if (valid.some(e => e.kind === "read-copy-permission" || e.kind === "waqf")) return { decision: RIGHTS_DECISIONS.READ_ONLY, confidence: 0.65, conflict: false };
  return { decision: RIGHTS_DECISIONS.UNCLEAR, confidence: 0, conflict: false };
}

export function buildSearchRecord(input = {}, metadata = {}) {
  const evidence = [...(input.evidence || [])];
  for (const signal of metadata.rightsSignals || []) evidence.push({ source: input.sourceUrl, ...signal });
  if (metadata.rights) evidence.push({ source: input.sourceUrl, kind: "rights-metadata", text: metadata.rights });
  const rights = classifyRightsEvidence(evidence);
  const classification = classifyEdition({
    ...input,
    author: firstDefined(input.author, metadata.author),
    publisher: firstDefined(input.publisher, metadata.publisher),
    license: firstDefined(input.license, metadata.rights),
    explicitRedistribution: rights.decision === RIGHTS_DECISIONS.REDISTRIBUTABLE
  }, { jurisdiction: input.jurisdiction ?? JURISDICTIONS.BERNE_BASELINE });
  return {
    ...input,
    title: firstDefined(input.title, metadata.title),
    author: firstDefined(input.author, metadata.author),
    publisher: firstDefined(input.publisher, metadata.publisher),
    license: firstDefined(input.license, metadata.rights),
    editionType: classification.editionType,
    rightsEvidence: evidence,
    rightsDecision: classification.decision,
    workStatus: classification.workStatus,
    editionNeedsReview: classification.editionNeedsReview,
    classificationReason: classification.reason,
    inspectedAt: new Date().toISOString()
  };
}

export async function searchAuthorDeath(authorName, options = {}) {
  if (!authorName) return { found: false, reason: "missing-author" };
  const language = options.language || "ar";
  const endpoint = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(authorName)}&language=${encodeURIComponent(language)}&format=json&limit=5&origin=*`;
  const response = await fetch(endpoint, { headers: { accept: "application/json", "user-agent": "Deen-Allah-Rechercher/2026" } });
  if (!response.ok) return { found: false, reason: `wikidata-http-${response.status}` };
  const data = await response.json();
  const candidates = data.search || [];
  for (const candidate of candidates) {
    const entity = await fetchWikidataEntity(candidate.id);
    const death = entity?.claims?.P570?.[0]?.mainsnak?.datavalue?.value?.time;
    const deathYear = death ? normalizeYear(death.replace(/^[+-]/, "")) : null;
    if (deathYear) return { found: true, qid: candidate.id, label: candidate.label, deathYear, source: `https://www.wikidata.org/wiki/${candidate.id}` };
  }
  return { found: false, candidates: candidates.map(x => ({ qid: x.id, label: x.label, description: x.description })) };
}

async function fetchWikidataEntity(qid) {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(qid)}.json`;
  const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "Deen-Allah-Rechercher/2026" } });
  if (!response.ok) return null;
  const data = await response.json();
  return data.entities?.[qid] || null;
}

export async function inspectSourceUrl(sourceUrl, options = {}) {
  const response = await fetch(sourceUrl, {
    redirect: "follow",
    headers: { accept: "text/html,application/xhtml+xml", "user-agent": "Deen-Allah-Rechercher/2026" }
  });
  const body = await response.text();
  const metadata = extractMetadataFromHtml(body);
  return {
    sourceUrl,
    finalUrl: response.url,
    httpStatus: response.status,
    contentType: response.headers.get("content-type"),
    metadata,
    searchedAt: new Date().toISOString()
  };
}
