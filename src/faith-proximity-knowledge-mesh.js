import { createHash } from 'node:crypto';

export const FAITH_ROOT = 'أبواب الإيمان والتعظيم والاقتداء';

export const DISCOVERY_STATES = Object.freeze([
  'discovered',
  'corroborated',
  'scholarly-reviewed',
  'rights-cleared',
  'publishable',
  'withdrawn'
]);

export const TRUTH_ENTITIES = Object.freeze([
  'quran_text',
  'hadith_text',
  'scholarly_explanation',
  'encyclopedia_analysis',
  'machine_translation'
]);

export const FAITH_SECTIONS = Object.freeze([
  'الله',
  'أسماء الله وصفاته',
  'عظمة الله',
  'آيات الله في الخَلْق',
  'محمد ﷺ',
  'شمائل النبي ﷺ',
  'هديه ووصاياه',
  'أهل البيت',
  'أمهات المؤمنين',
  'الصحابة',
  'الأنبياء والرسل',
  'السلف والعلماء',
  'القربات إلى الله',
  'الذكر',
  'التوبة',
  'التقوى',
  'الإحسان',
  'مكارم الأخلاق',
  'الآخرة',
  'قصص العبرة والهداية'
]);

export const QURBAH_FAMILIES = Object.freeze([
  'الفرائض',
  'النوافل',
  'أعمال القلوب',
  'الأذكار والأقوال',
  'القربات المالية',
  'مواسم العبادة',
  'النسك',
  'الإحسان الاجتماعي',
  'طلب العلم وتعليمه',
  'العادات المباحة إذا صحت النية'
]);

export const PROFESSIONAL_CAPABILITIES = Object.freeze([
  'discovery',
  'source_verification',
  'hadith_evidence',
  'quran_text_integrity',
  'tafsir_provenance',
  'ocr',
  'translation',
  'media_quality',
  'rights',
  'publication'
]);

export const ALLOWED_REUSABLE_ASSETS = Object.freeze([
  'public-domain',
  'cc0',
  'cc-by',
  'cc-by-sa',
  'explicit-permission',
  'owned-original'
]);

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function unique(values) {
  return [...new Set(values)];
}

function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function rightsCleared(asset = {}) {
  return ALLOWED_REUSABLE_ASSETS.includes(asset.rightsStatus) &&
    (asset.redistributionAllowed === true || asset.rightsStatus === 'public-domain' ||
      asset.rightsStatus === 'cc0' || asset.rightsStatus === 'owned-original');
}

function isIndependentEngine(item) {
  return nonEmpty(item?.engineId) && item.independent === true;
}

export function createFaithRoot() {
  return Object.freeze({
    id: 'faith-proximity-root',
    label: FAITH_ROOT,
    sections: [...FAITH_SECTIONS],
    corpusMutation: false
  });
}

export function createKnowledgeSubject({
  id,
  section,
  definition,
  originalTexts = [],
  sourceRecords = [],
  verificationState = 'discovered',
  scholarlyStatements = [],
  context = null,
  relations = [],
  analysis = [],
  benefits = [],
  summary = null,
  rights = null
} = {}) {
  if (!nonEmpty(id) || !nonEmpty(section) || !FAITH_SECTIONS.includes(section)) {
    throw new TypeError('subject id and known faith section are required');
  }
  if (!DISCOVERY_STATES.includes(verificationState)) {
    throw new TypeError('invalid verification state');
  }
  return Object.freeze({
    id,
    section,
    definition: definition ?? null,
    originalTexts: [...originalTexts],
    sourceRecords: [...sourceRecords],
    verificationState,
    scholarlyStatements: [...scholarlyStatements],
    context,
    relations: [...relations],
    analysis: analysis.map((value) => ({ type: 'encyclopedia_analysis', value })),
    benefits: [...benefits],
    summary,
    rights: rights ? Object.freeze({ ...rights }) : null,
    corpusMutation: false
  });
}

export function createTruthEntity({ id, kind, content, sourceIds = [], status = 'draft' } = {}) {
  if (!nonEmpty(id) || !nonEmpty(content) || !TRUTH_ENTITIES.includes(kind)) {
    throw new TypeError('truth entity id, kind and content are required');
  }
  if (!sourceIds.length) throw new TypeError('truth entity requires source references');
  const derived = kind === 'machine_translation' || kind === 'encyclopedia_analysis';
  return Object.freeze({
    id,
    kind,
    content,
    sourceIds: unique(sourceIds),
    status,
    canonical: kind === 'quran_text' || kind === 'hadith_text',
    derived,
    authoritative: kind === 'quran_text' || kind === 'hadith_text' ? true : false
  });
}

export function corroborateDiscovery(candidate = {}, corroborators = []) {
  const independent = corroborators.filter(isIndependentEngine);
  if (independent.length < 2) {
    return Object.freeze({ state: 'discovered', passed: false, reason: 'two_independent_corrobators_required' });
  }
  return Object.freeze({
    state: 'corroborated',
    passed: true,
    corroboratedBy: unique(independent.map((item) => item.engineId)),
    singleEngineApprovalAllowed: false
  });
}

export function scholarlyReview(candidate = {}, reviews = []) {
  const independentReviews = reviews.filter(isIndependentEngine);
  if (candidate.state !== 'corroborated') {
    return Object.freeze({ state: candidate.state || 'discovered', passed: false, reason: 'corroboration_required_first' });
  }
  if (independentReviews.length < 2) {
    return Object.freeze({ state: 'corroborated', passed: false, reason: 'two_independent_reviews_required' });
  }
  return Object.freeze({
    state: 'scholarly-reviewed',
    passed: true,
    reviewedBy: unique(independentReviews.map((item) => item.engineId)),
    singleEngineApprovalAllowed: false
  });
}

export function clearRights(candidate = {}, evidence = {}) {
  const required = ['rightsSource', 'rightsEvidenceId', 'checkedAt', 'checkedBy', 'license'];
  const complete = required.every((field) => nonEmpty(evidence[field]));
  const allowed = evidence.redistributionAllowed === true;
  if (candidate.state !== 'scholarly-reviewed' || !complete || !allowed) {
    return Object.freeze({ state: candidate.state || 'discovered', passed: false, reason: 'rights_not_cleared' });
  }
  return Object.freeze({
    state: 'rights-cleared',
    passed: true,
    rights: Object.freeze({ ...evidence })
  });
}

export function publishCandidate(candidate = {}, { publicationReviews = [], rights = {}, qualityScore = 0 } = {}) {
  const independent = publicationReviews.filter(isIndependentEngine);
  const gates = {
    state: candidate.state === 'rights-cleared',
    rights: rightsCleared({ ...rights, redistributionAllowed: rights.redistributionAllowed }),
    quality: typeof qualityScore === 'number' && qualityScore >= 80,
    review: independent.length >= 2
  };
  const passed = Object.values(gates).every(Boolean);
  return Object.freeze({
    state: passed ? 'publishable' : 'rights-cleared',
    passed,
    gates,
    publicationReviewers: unique(independent.map((item) => item.engineId))
  });
}

export function createQurbahRecord({
  id,
  family,
  title,
  evidenceIds = [],
  ruling = null,
  conditions = [],
  pillars = [],
  sunnan = [],
  virtues = [],
  objectives = [],
  commonMistakes = [],
  spiritualEffects = [],
  sincerity = [],
  following = [],
  rights = null
} = {}) {
  if (!nonEmpty(id) || !nonEmpty(title) || !QURBAH_FAMILIES.includes(family)) {
    throw new TypeError('qurbah id, title and family are required');
  }
  if (!evidenceIds.length) throw new TypeError('qurbah requires evidence');
  return Object.freeze({
    id, family, title,
    evidenceIds: unique(evidenceIds),
    ruling, conditions:[...conditions], pillars:[...pillars], sunnan:[...sunnan],
    virtues:[...virtues], objectives:[...objectives], commonMistakes:[...commonMistakes],
    spiritualEffects:[...spiritualEffects], sincerity:[...sincerity], following:[...following],
    rights: rights ? Object.freeze({ ...rights }) : null,
    corpusMutation: false
  });
}

export function createCompanionRecord({
  id,
  name,
  lineage = null,
  kunya = null,
  companionshipStatus = 'disputed',
  companionshipEvidence = [],
  positions = [],
  narrations = [],
  relationToProphet = [],
  works = [],
  sayings = [],
  scholarStatements = [],
  events = [],
  death = null,
  sources = []
} = {}) {
  if (!nonEmpty(id) || !nonEmpty(name)) throw new TypeError('companion id and name are required');
  const allowed = ['confirmed', 'disputed', 'not-confirmed'];
  if (!allowed.includes(companionshipStatus)) throw new TypeError('invalid companionship status');
  return Object.freeze({
    id, name, lineage, kunya, companionshipStatus,
    companionshipEvidence:[...companionshipEvidence],
    positions:[...positions], narrations:[...narrations], relationToProphet:[...relationToProphet],
    works:[...works], sayings:[...sayings], scholarStatements:[...scholarStatements],
    events:[...events], death, sources:[...sources],
    automatedCompanionshipVerdict:false,
    corpusMutation:false
  });
}

export function createLanguageRecord({
  locale,
  language,
  script,
  region = null,
  direction = 'ltr',
  sourceTextLocale = locale,
  translationStatus = 'source-language',
  translator = null,
  reviewer = null,
  machineGenerated = false
} = {}) {
  if (!nonEmpty(locale) || !nonEmpty(language) || !nonEmpty(script)) {
    throw new TypeError('locale, language and script are required');
  }
  if (!['rtl', 'ltr'].includes(direction)) throw new TypeError('invalid direction');
  const statusAllowed = ['source-language', 'machine-draft', 'human-reviewed', 'approved'];
  if (!statusAllowed.includes(translationStatus)) throw new TypeError('invalid translation status');
  if (machineGenerated && translationStatus !== 'machine-draft') {
    throw new TypeError('machine translation must remain a draft');
  }
  return Object.freeze({
    locale, language, script, region, direction, sourceTextLocale, translationStatus,
    translator, reviewer, machineGenerated: machineGenerated === true,
    canonicalQuranTextIndependent:true,
    approvedReligiousTranslation: translationStatus === 'approved'
  });
}

export function createDiscoveryCandidate({
  id, title, sourceIds = [], discoveredAt, sourceType = 'open-web', mediaRefs = []
} = {}) {
  if (!nonEmpty(id) || !nonEmpty(title) || !nonEmpty(discoveredAt) || !sourceIds.length) {
    throw new TypeError('discovery candidate requires id, title, source ids and time');
  }
  return Object.freeze({
    id, title, sourceIds:unique(sourceIds), discoveredAt, sourceType,
    mediaRefs:[...mediaRefs], state:'discovered', scientificAuthority:false, corpusMutation:false
  });
}

export function evaluateCardSource({ contentIds = [], locale, asset = {}, templateId, templateVersion } = {}) {
  if (!contentIds.length || !nonEmpty(locale) || !nonEmpty(templateId) || !nonEmpty(templateVersion)) {
    throw new TypeError('card requires approved content, locale and versioned template');
  }
  const contentApproved = contentIds.every((item) => item?.state === 'publishable');
  const reusable = !asset.url || rightsCleared(asset);
  const fingerprint = stableHash({
    contentIds: contentIds.map((item) => item.id),
    locale, asset: asset.url ? { url:asset.url, sha256:asset.sha256, rights:asset.rightsStatus } : null,
    templateId, templateVersion
  });
  return Object.freeze({
    allowed: contentApproved && reusable,
    fingerprint,
    deterministic:true,
    vectorFirst:true,
    formats:['svg','png','webp','pdf'],
    footer:'موسوعة دين الله',
    rightsCleared:reusable,
    sourceIds:contentIds.flatMap((item) => item.sourceIds || []),
    machineTranslationMustRemainDraft:true
  });
}

export function createRelation({ subjectId, relation, objectId, evidenceIds = [], confidenceState = 'discovered' } = {}) {
  if (![subjectId, objectId, relation].every(nonEmpty)) throw new TypeError('relation fields required');
  return Object.freeze({
    subjectId, relation, objectId, evidenceIds:unique(evidenceIds),
    confidenceState, scientificAuthority:confidenceState === 'publishable'
  });
}

export function createProfessionalEngineRequirement({ capability, engines = [] } = {}) {
  if (!nonEmpty(capability)) throw new TypeError('capability is required');
  const independent = engines.filter(isIndependentEngine);
  return Object.freeze({
    capability,
    minimumEngines:2,
    preferredEngines:3,
    engines:unique(independent.map((item) => item.engineId)),
    minimumSatisfied:independent.length >= 2,
    preferredSatisfied:independent.length >= 3,
    singleEngineApprovalAllowed:false
  });
}

export function faithMeshPolicy() {
  return Object.freeze({
    root:FAITH_ROOT,
    technicalLayerAboveCorpus:true,
    discoveryIsNotApproval:true,
    stateSequence:[...DISCOVERY_STATES],
    minimumIndependentEngines:2,
    preferredIndependentEngines:3,
    truthEntities:[...TRUTH_ENTITIES],
    quranTranslationIsSeparate:true,
    machineTranslationIsDraftOnly:true,
    companionshipDisagreementExplicit:true,
    cardFormats:['svg','png','webp','pdf'],
    vectorFirst:true,
    freeAccessTarget:true,
    freeDoesNotMeanPublicDomain:true,
    restrictedAssetsRemainReferenceOnly:true,
    corpusMutationRequiresProtectedReview:true
  });
}
