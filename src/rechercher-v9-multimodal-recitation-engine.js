import { createStageNodeContract } from './rechercher-stage-node-contract.js';
import { registerNode } from './rechercher-stage-network-registry.js';

export const V9_STAGE_ID = 'V9_MULTIMODAL_ISLAMIC_LEARNING';
export const V9_ALIGNMENT_STATES = Object.freeze(['UNALIGNED', 'PARTIAL', 'ALIGNED', 'REVIEW_REQUIRED']);
export const V9_ERROR_TYPES = Object.freeze(['OMISSION', 'ADDITION', 'SUBSTITUTION', 'REPETITION', 'HESITATION', 'BOUNDARY_DRIFT', 'TAJWEED_CANDIDATE']);
export const V9_MATCH_TYPES = Object.freeze(['EXACT', 'CLOSE', 'NO_MATCH']);
export const V9_TERM_RELATIONS = Object.freeze(['EXACT_EQUIVALENT', 'APPROXIMATE_EQUIVALENT', 'HISTORICAL_EQUIVALENT', 'SCHOOL_SPECIFIC_TERM', 'TRANSLATION_VARIANT', 'NO_EXACT_EQUIVALENT']);

const IMMUTABLE_FIELDS = Object.freeze(['sourceIdentity', 'contentHash', 'canonicalQuranArabic', 'originalPdf']);
const clone = value => structuredClone(value);

function requireId(value, name) { if (!value) throw new TypeError(`${name} is required`); }
function assertOneOf(value, values, name) { if (!values.includes(value)) throw new TypeError(`invalid ${name}: ${value}`); }
function assertRights(input) {
  if (!['ALLOWED', 'RESTRICTED', 'UNKNOWN', 'EXPLICIT_PERMISSION_REQUIRED'].includes(input)) throw new TypeError(`invalid rights state: ${input}`);
}
function preserveImmutable(before, after) {
  for (const field of IMMUTABLE_FIELDS) {
    if (before?.[field] === undefined || before?.[field] === null) continue;
    if (JSON.stringify(before[field]) !== JSON.stringify(after?.[field])) throw new Error(`V9 cannot mutate immutable field: ${field}`);
  }
}

export function createV9StageNodeContract() {
  return createStageNodeContract({
    stageId: V9_STAGE_ID,
    version: '1.0',
    capabilities: [
      'MULTIMODAL_TEXT_AUDIO_IMAGE_VIDEO_PDF',
      'SOURCE_IDENTITY_CHAIN',
      'IIIF_MANIFEST_PAGE_CANVAS_ALIGNMENT',
      'OCR_TRANSCRIPTION_ALIGNMENT',
      'RECITATION_TRACKING',
      'VERSE_WORD_ALIGNMENT',
      'TAJWEED_CANDIDATE_DETECTION',
      'OMISSION_ADDITION_SUBSTITUTION_DETECTION',
      'HESITATION_REPETITION_ANALYSIS',
      'MEMORIZATION_STATE',
      'SPACED_MEMORIZATION',
      'MULTILINGUAL_CONCEPT_ALIGNMENT',
      'RECITATION_FEEDBACK',
      'HUMAN_SCHOLAR_REVIEW_BOUNDARY'
    ],
    acceptedInputs: [{ type: 'VERIFIED_SOURCE' }, { type: 'LEARNING_PLAN' }, { type: 'CANONICAL_QURAN_ARABIC' }],
    producedOutputs: [{ type: 'MULTIMODAL_ALIGNMENT' }, { type: 'RECITATION_ASSESSMENT' }, { type: 'MEMORIZATION_STATE' }, { type: 'MULTILINGUAL_CONCEPT_ALIGNMENT' }],
    requiredEvidence: [{ type: 'SOURCE_IDENTITY' }, { type: 'PROVENANCE' }, { type: 'RIGHTS_STATE' }, { type: 'ALIGNMENT_EVIDENCE' }],
    rightsPolicy: { defaultState: 'UNKNOWN', publishableState: 'ALLOWED', unknownIsPublishable: false, restrictedIsPublishable: false },
    reviewPolicy: { scholarlyVerification: true, humanReviewForAuthoritativeUse: true, recitationFeedbackIsNonFatwa: true },
    dependencies: ['V6_GLOBAL_SOURCE_INTELLIGENCE', 'V7_GLOBAL_RESEARCH_GRAPH', 'V8_AUTONOMOUS_ADAPTIVE_LEARNING'],
    handoffs: ['SOURCE_TO_MULTIMODAL', 'KNOWLEDGE_TO_RECITATION', 'RECITATION_TO_LEARNING', 'MULTIMODAL_TO_RESEARCH'],
    safety: { canOverrideRights: false, canMutateSourceIdentity: false, canMutateContentHash: false, canMutateCanonicalQuranArabic: false, canMutateOriginalPdf: false, acquisitionIndependent: true, religiousDecisionAuthority: false },
    status: 'OPEN_EXTENSION_POINT'
  });
}

export function registerV9Node(registry) { return registerNode(registry, createV9StageNodeContract()); }

export function createV9MultimodalRecitationEngine({ observability = null } = {}) {
  return { stageId: V9_STAGE_ID, version: '9.0.0', status: 'IMPLEMENTED_FOUNDATION', observability, sourceIdentities: new Map(), manifests: new Map(), alignments: [], recitations: new Map(), memorization: new Map(), terminology: [], traces: [] };
}

export function createSourceIdentity(input = {}) {
  for (const key of ['source_id', 'work_id', 'edition_id', 'manifestation_id', 'language', 'retrieval_date', 'content_hash']) requireId(input[key], key);
  assertRights(input.rights);
  requireId(input.provenance, 'provenance');
  return Object.freeze({
    source_id: input.source_id,
    work_id: input.work_id,
    edition_id: input.edition_id,
    manifestation_id: input.manifestation_id,
    page_id: input.page_id || null,
    passage_id: input.passage_id || null,
    language: input.language,
    license: input.license || null,
    rights: input.rights,
    provenance: clone(input.provenance),
    retrieval_date: input.retrieval_date,
    content_hash: input.content_hash
  });
}

export function registerSourceIdentity(engine, identity) {
  const record = createSourceIdentity(identity);
  engine.sourceIdentities.set(record.source_id, clone(record));
  trace(engine, 'SOURCE_IDENTITY_REGISTERED', { source_id: record.source_id });
  return clone(record);
}

export function createIiifPageModel(input = {}) {
  requireId(input.manifestId, 'manifestId'); requireId(input.canvasId, 'canvasId'); requireId(input.pageId, 'pageId'); requireId(input.imageId, 'imageId');
  if (!Array.isArray(input.annotations)) throw new TypeError('annotations must be an array');
  return Object.freeze({
    manifestId: input.manifestId,
    canvasId: input.canvasId,
    pageId: input.pageId,
    image: { id: input.imageId, type: 'Image', format: input.imageFormat || 'image/jpeg' },
    ocr: input.ocr || null,
    transcription: input.transcription || null,
    normalizedText: input.normalizedText || null,
    translations: clone(input.translations || []),
    annotations: clone(input.annotations),
    scholarNotes: clone(input.scholarNotes || []),
    citations: clone(input.citations || []),
    confidence: input.confidence ?? null,
    language: input.language || null
  });
}

export function registerIiifPage(engine, page) {
  const model = createIiifPageModel(page);
  engine.manifests.set(model.pageId, clone(model));
  trace(engine, 'IIIF_PAGE_REGISTERED', { pageId: model.pageId, canvasId: model.canvasId });
  return clone(model);
}

export function alignTextToMedia(engine, input = {}) {
  requireId(input.alignmentId, 'alignmentId'); requireId(input.mediaId, 'mediaId'); requireId(input.textId, 'textId');
  if (!Array.isArray(input.segments) || !input.segments.length) throw new TypeError('segments are required');
  const segments = input.segments.map((segment, index) => {
    requireId(segment.text, `segments[${index}].text`);
    if (!Number.isFinite(segment.startMs) || !Number.isFinite(segment.endMs) || segment.endMs < segment.startMs) throw new TypeError('invalid media timing');
    return { ...clone(segment), index };
  });
  const result = { alignmentId: input.alignmentId, mediaId: input.mediaId, textId: input.textId, state: input.state || 'ALIGNED', method: input.method || 'REVIEWED_ALIGNMENT', segments, provenance: clone(input.provenance || null) };
  assertOneOf(result.state, V9_ALIGNMENT_STATES, 'alignment state');
  engine.alignments.push(result); trace(engine, 'TEXT_MEDIA_ALIGNED', { alignmentId: result.alignmentId, segments: segments.length });
  return clone(result);
}

export function trackRecitation(engine, input = {}) {
  requireId(input.sessionId, 'sessionId'); requireId(input.sourceId, 'sourceId'); requireId(input.surahId, 'surahId');
  if (!Array.isArray(input.ayahs)) throw new TypeError('ayahs are required');
  const session = { sessionId: input.sessionId, sourceId: input.sourceId, surahId: input.surahId, riwayah: input.riwayah || 'HAFS_AN_ASIM', startedAt: input.startedAt || new Date().toISOString(), ayahs: clone(input.ayahs), alignmentConfidence: input.alignmentConfidence ?? null, reviewState: input.reviewState || 'UNREVIEWED' };
  engine.recitations.set(session.sessionId, session); trace(engine, 'RECITATION_TRACKED', { sessionId: session.sessionId, ayahCount: session.ayahs.length });
  return clone(session);
}

export function analyzeRecitation(input = {}) {
  requireId(input.referenceWords, 'referenceWords'); requireId(input.observedWords, 'observedWords');
  const reference = Array.isArray(input.referenceWords) ? input.referenceWords : [];
  const observed = Array.isArray(input.observedWords) ? input.observedWords : [];
  const errors = [];
  let i = 0, j = 0;
  while (i < reference.length || j < observed.length) {
    if (i < reference.length && j < observed.length && reference[i].word === observed[j].word) { i++; j++; continue; }
    if (i < reference.length && (!observed[j] || reference[i + 1]?.word === observed[j]?.word)) { errors.push({ type: 'OMISSION', expected: reference[i], observed: null }); i++; continue; }
    if (j < observed.length && (!reference[i] || observed[j + 1]?.word === reference[i]?.word)) { errors.push({ type: 'ADDITION', expected: null, observed: observed[j] }); j++; continue; }
    if (i < reference.length && j < observed.length) { errors.push({ type: 'SUBSTITUTION', expected: reference[i], observed: observed[j] }); i++; j++; }
  }
  const repetitions = observed.filter((word, index) => index > 0 && word.word === observed[index - 1].word).length;
  const hesitations = Number(input.hesitationCount || 0);
  const tajweedCandidates = clone(input.tajweedCandidates || []);
  return { matchType: errors.length ? 'CLOSE' : 'EXACT', errors, repetitionCount: repetitions, hesitationCount: hesitations, tajweedCandidates, confidence: input.confidence ?? null, reviewRequired: Boolean(errors.length || tajweedCandidates.length) };
}

export function recordRecitationAssessment(engine, sessionId, assessment) {
  const session = engine.recitations.get(sessionId); if (!session) throw new Error('recitation session not found');
  const result = { ...clone(assessment), sessionId, religiousRuling: false, authoritativeFatwa: false, humanReviewRequiredForReligiousJudgment: true };
  session.assessment = result; engine.recitations.set(sessionId, session); trace(engine, 'RECITATION_ASSESSED', { sessionId, errorCount: assessment.errors?.length || 0 });
  return clone(result);
}

export function updateMemorizationState(engine, input = {}) {
  requireId(input.learnerId, 'learnerId'); requireId(input.unitId, 'unitId');
  const state = { learnerId: input.learnerId, unitId: input.unitId, retention: input.retention ?? 0, fluency: input.fluency ?? 0, accuracy: input.accuracy ?? 0, lastReviewedAt: input.lastReviewedAt || null, nextReviewAt: input.nextReviewAt || null, errorHistory: clone(input.errorHistory || []), confidence: input.confidence ?? null, masteryStatus: input.masteryStatus || 'DEVELOPING' };
  engine.memorization.set(`${state.learnerId}:${state.unitId}`, state); trace(engine, 'MEMORIZATION_STATE_UPDATED', { learnerId: state.learnerId, unitId: state.unitId, masteryStatus: state.masteryStatus });
  return clone(state);
}

export function scheduleSpacedMemorization(engine, learnerId, unitId, outcome = {}) {
  const key = `${learnerId}:${unitId}`; const current = engine.memorization.get(key); if (!current) throw new Error('memorization state not found');
  const quality = Math.max(0, Math.min(1, Number(outcome.quality ?? current.accuracy ?? 0)));
  const baseDays = quality >= 0.9 ? 7 : quality >= 0.75 ? 3 : quality >= 0.5 ? 1 : 0.25;
  const next = new Date(Date.now() + baseDays * 86400000).toISOString();
  const updated = { ...current, nextReviewAt: next, lastOutcome: clone(outcome) };
  engine.memorization.set(key, updated); trace(engine, 'SPACED_MEMORIZATION_SCHEDULED', { learnerId, unitId, nextReviewAt: next });
  return clone(updated);
}

export function alignMultilingualConcept(engine, input = {}) {
  requireId(input.conceptId, 'conceptId'); requireId(input.sourceLanguage, 'sourceLanguage'); requireId(input.targetLanguage, 'targetLanguage'); requireId(input.sourceTerm, 'sourceTerm'); requireId(input.targetTerm, 'targetTerm');
  assertOneOf(input.relation, V9_TERM_RELATIONS, 'term relation');
  const alignment = { alignmentId: input.alignmentId || `term-${engine.terminology.length + 1}`, conceptId: input.conceptId, sourceLanguage: input.sourceLanguage, targetLanguage: input.targetLanguage, sourceTerm: input.sourceTerm, targetTerm: input.targetTerm, relation: input.relation, confidence: input.confidence ?? null, provenance: clone(input.provenance || null), scholarReview: Boolean(input.scholarReview) };
  engine.terminology.push(alignment); trace(engine, 'MULTILINGUAL_CONCEPT_ALIGNED', { alignmentId: alignment.alignmentId, relation: alignment.relation });
  return clone(alignment);
}

export function createRecitationFeedback(assessment = {}) {
  return { ...clone(assessment), feedbackMode: 'LEARNING_ASSISTANCE', canDeclareReligiousRuling: false, canIssueFatwa: false, shouldEscalateAmbiguousReligiousJudgment: true, suggestedActions: assessment.errors?.length ? ['REPEAT_AFFECTED_SEGMENT', 'REVIEW_REFERENCE', 'HUMAN_TEACHER_CHECK_IF_NEEDED'] : ['CONTINUE', 'SCHEDULE_SPACED_REVIEW'] };
}

export function trace(engine, type, payload = {}) {
  const traceId = `rechercher-v9-trace-${engine.traces.length + 1}`;
  const event = { traceId, type, at: new Date().toISOString(), ...clone(payload) }; engine.traces.push(event); if (engine.observability?.record) engine.observability.record(event); return traceId;
}

export function v9Health(engine) {
  return { stageId: engine.stageId, version: engine.version, status: engine.status, sourceIdentities: engine.sourceIdentities.size, pages: engine.manifests.size, alignments: engine.alignments.length, recitationSessions: engine.recitations.size, memorizationStates: engine.memorization.size, terminologyAlignments: engine.terminology.length, traces: engine.traces.length };
}
