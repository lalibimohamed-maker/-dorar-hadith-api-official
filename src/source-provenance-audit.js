import { getRegistry } from './source-registry.js';

const URL_RE = /^https?:\/\/[^\s]+$/i;
const RIGHTS = new Set(['licensed', 'public-domain', 'permission-required', 'link-only', 'unknown']);
const VERIFICATION = new Set(['verified', 'partially_verified', 'unverified', 'needs_review']);

function inferSourceType(source) {
  if (source.category === 'fatwa' || String(source.sourceKind || '').includes('fatwa')) return 'fatwa';
  if (source.role === 'primary-book' || source.role === 'book' || source.category === 'library') return 'book';
  if (source.category === 'hadith' || source.category === 'hadith-sciences') return 'hadith';
  if (source.category === 'quran') return 'quran';
  if (source.category === 'tafsir') return 'tafsir';
  if (source.category === 'official' || String(source.role || '').startsWith('official-')) return 'institutional';
  return source.category || 'other';
}

function normalize(source) {
  const sourceType = source.sourceType || inferSourceType(source);
  const hasIdentity = Boolean(source.id && (source.nameAr || source.name || source.scholar));
  const hasLocator = Boolean(source.url || source.canonicalUrl || source.bibliographicLocator);
  const rights = source.rights?.status || source.rightsStatus || source.reusePolicy || 'unknown';
  const verification = source.verification?.status || source.verificationStatus || 'unverified';
  const rightsStatus = RIGHTS.has(rights) ? rights : 'unknown';
  const verificationStatus = VERIFICATION.has(verification) ? verification : 'unverified';

  return {
    sourceId: source.id,
    identity: {
      nameAr: source.nameAr || source.name || source.scholar || null,
      author: source.authorAr || source.author || source.scholar || null,
      institution: source.institution || null,
      country: source.country || null
    },
    sourceType,
    category: source.category || null,
    role: source.role || null,
    locator: {
      canonicalUrl: source.canonicalUrl || source.url || null,
      bibliographicLocator: source.bibliographicLocator || null,
      locatorPresent: hasLocator,
      urlValid: !source.url || URL_RE.test(source.url)
    },
    attribution: {
      required: source.attributionRequired !== false,
      noEndorsementByInclusion: source.noEndorsementByInclusion !== false
    },
    rights: {
      status: rightsStatus,
      explicit: Boolean(source.rights || source.rightsStatus || source.reusePolicy),
      raw: source.rights || source.rightsStatus || source.reusePolicy || null
    },
    verification: {
      status: verificationStatus,
      explicit: Boolean(source.verification || source.verificationStatus),
      evidence: source.verification?.evidence || source.verificationEvidence || []
    },
    quality: {
      identityComplete: hasIdentity,
      locatorComplete: hasLocator,
      rightsExplicit: Boolean(source.rights || source.rightsStatus || source.reusePolicy),
      verificationExplicit: Boolean(source.verification || source.verificationStatus),
      safeForRedistribution: rightsStatus === 'licensed' || rightsStatus === 'public-domain',
      safeForNavigationOnly: rightsStatus === 'link-only' || rightsStatus === 'permission-required' || rightsStatus === 'unknown'
    }
  };
}

export function auditSources(registry = getRegistry()) {
  const sources = Array.isArray(registry.sources) ? registry.sources : [];
  const normalized = sources.map(normalize);
  const duplicateIds = normalized.map(s => s.sourceId).filter((id, i, all) => all.indexOf(id) !== i);
  const issues = [];

  for (const source of normalized) {
    if (!source.sourceId) issues.push({ sourceId: null, code: 'MISSING_SOURCE_ID' });
    if (!source.quality.identityComplete) issues.push({ sourceId: source.sourceId, code: 'INCOMPLETE_IDENTITY' });
    if (!source.quality.locatorComplete && source.sourceType !== 'book') issues.push({ sourceId: source.sourceId, code: 'MISSING_LOCATOR' });
    if (!source.locator.urlValid) issues.push({ sourceId: source.sourceId, code: 'INVALID_URL' });
    if (source.verification.status === 'verified' && source.verification.evidence.length === 0) issues.push({ sourceId: source.sourceId, code: 'VERIFIED_WITHOUT_EVIDENCE' });
  }

  for (const sourceId of [...new Set(duplicateIds)]) issues.push({ sourceId, code: 'DUPLICATE_SOURCE_ID' });

  const counts = normalized.reduce((acc, source) => {
    acc.total += 1;
    acc.byType[source.sourceType] = (acc.byType[source.sourceType] || 0) + 1;
    acc.byVerification[source.verification.status] = (acc.byVerification[source.verification.status] || 0) + 1;
    acc.byRights[source.rights.status] = (acc.byRights[source.rights.status] || 0) + 1;
    return acc;
  }, { total: 0, byType: {}, byVerification: {}, byRights: {} });

  return { version: '1.0.0', counts, issues, sources: normalized };
}

export function assertSourceContract(registry = getRegistry()) {
  const report = auditSources(registry);
  const blocking = report.issues.filter(issue => ['MISSING_SOURCE_ID', 'INCOMPLETE_IDENTITY', 'INVALID_URL', 'DUPLICATE_SOURCE_ID', 'VERIFIED_WITHOUT_EVIDENCE'].includes(issue.code));
  if (blocking.length) {
    const detail = blocking.slice(0, 20).map(issue => `${issue.sourceId || '<none>'}:${issue.code}`).join(', ');
    throw new Error(`Source provenance contract failed (${blocking.length}): ${detail}`);
  }
  return report;
}
