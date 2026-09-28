/**
 * Global Multilingual Knowledge Network 2026.
 *
 * Language is a presentation/retrieval layer over one shared knowledge graph.
 * It never changes Corpus identity, source authority, or evidentiary status.
 */

export const RETRIEVAL_PIPELINE = Object.freeze([
  'user-language',
  'intent-detection',
  'multilingual-retrieval',
  'source-verification',
  'provenance-graph',
  'response-user-language'
]);

export const LANGUAGE_FIELDS = Object.freeze([
  'uiLanguage',
  'queryLanguage',
  'responseLanguage',
  'sourceLanguage'
]);

export const TRANSLATION_STATES = Object.freeze([
  'source-original',
  'machine-draft',
  'human-reviewed',
  'verified'
]);

export const MEDIA_KINDS = Object.freeze([
  'video',
  'audio',
  'article',
  'image',
  'post',
  'podcast',
  'other-media'
]);

const SCRIPT_PATTERNS = Object.freeze([
  ['ar','Arabic','rtl',/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\uFB50-\uFDFF\uFE70-\uFEFF]/u],
  ['fa','Persian','rtl',/[\u067e\u0686\u0698\u06af]/u],
  ['ur','Urdu','rtl',/[\u0679\u0688\u0691\u0693\u06ba\u06be\u06c1\u06d2]/u],
  ['he','Hebrew','rtl',/[\u0590-\u05ff]/u],
  ['ru','Russian','ltr',/[\u0400-\u04ff]/u],
  ['uk','Ukrainian','ltr',/[\u0400-\u04ff]/u],
  ['el','Greek','ltr',/[\u0370-\u03ff]/u],
  ['hi','Hindi','ltr',/[\u0900-\u097f]/u],
  ['bn','Bengali','ltr',/[\u0980-\u09ff]/u],
  ['th','Thai','ltr',/[\u0e00-\u0e7f]/u],
  ['ko','Korean','ltr',/[\uac00-\ud7af]/u],
  ['zh','Chinese','ltr',/[\u3400-\u4dbf\u4e00-\u9fff]/u],
  ['ja','Japanese','ltr',/[\u3040-\u30ff]/u]
]);

const LATIN_HINTS = Object.freeze({
  en: ['the','and','is','are','with','from','what','how','about','quran','hadith'],
  fr: ['le','la','les','des','et','est','avec','depuis','quel','comment','coran','hadith'],
  es: ['el','la','los','las','y','es','con','desde','qué','cómo','corán','hadiz'],
  de: ['der','die','das','und','ist','mit','von','was','wie','quran','hadith'],
  tr: ['ve','bir','için','olan','nasıl','kuran','hadis'],
  id: ['dan','yang','untuk','dengan','apa','bagaimana','quran','hadis'],
  ms: ['dan','yang','untuk','dengan','apa','bagaimana','quran','hadis'],
  pt: ['o','a','os','as','e','é','com','como','alcorão','hadith']
});

function normalize(value) {
  return String(value || '').normalize('NFKC').trim().toLowerCase();
}

function tokenise(text) {
  return normalize(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function countScript(text, regex) {
  return (normalize(text).match(new RegExp(regex.source, 'gu')) || []).length;
}

function latinHintScore(tokens, hints) {
  if (!tokens.length) return 0;
  const set = new Set(tokens);
  return hints.filter((word) => set.has(word)).length / Math.max(1, Math.min(tokens.length, 8));
}

export function languageDirection(languageOrLocale = '') {
  const value = normalize(languageOrLocale);
  if (['ar','fa','ur','he','ps','dv'].some((x) => value === x || value.startsWith(x + '-'))) return 'rtl';
  return 'ltr';
}

export function detectUserLanguages(text = '') {
  const value = String(text || '');
  const tokens = tokenise(value);
  const scores = [];

  for (const [language, label, direction, regex] of SCRIPT_PATTERNS) {
    const scriptHits = countScript(value, regex);
    if (scriptHits > 0) scores.push({ language, label, direction, score: scriptHits, source: 'script' });
  }

  for (const [language, hints] of Object.entries(LATIN_HINTS)) {
    const score = latinHintScore(tokens, hints);
    if (score > 0) scores.push({ language, label: language, direction: languageDirection(language), score, source: 'lexical' });
  }

  const merged = new Map();
  for (const item of scores) {
    const prior = merged.get(item.language);
    if (!prior || item.score > prior.score) merged.set(item.language, item);
  }

  const languages = [...merged.values()].sort((a,b) => b.score - a.score);
  return Object.freeze({
    primary: languages[0]?.language || null,
    direction: languageDirection(languages[0]?.language || 'en'),
    languages: languages.slice(0, 8),
    mixed: languages.length > 1,
    confidence: languages.length ? Math.min(1, languages[0].score / Math.max(1, value.length / 20)) : 0
  });
}

export function resolvePresentationLanguages({
  detected,
  uiLanguage = null,
  preferredResponseLanguage = null,
  queryLanguage = null,
  sourceLanguage = null
} = {}) {
  const primary = detected?.primary || queryLanguage || preferredResponseLanguage || uiLanguage || sourceLanguage || 'en';
  const responseLanguage = preferredResponseLanguage || detected?.primary || queryLanguage || uiLanguage || 'en';
  return Object.freeze({
    uiLanguage,
    queryLanguage: queryLanguage || detected?.primary || null,
    responseLanguage,
    sourceLanguage,
    detectedUserLanguage: detected?.primary || null,
    responseDirection: languageDirection(responseLanguage),
    sourceDirection: languageDirection(sourceLanguage || responseLanguage),
    independentLayers: true
  });
}

export function registerCanonicalEntity({ canonicalId, aliases = {}, sourceIds = [] } = {}) {
  if (!canonicalId) throw new TypeError('canonicalId is required');
  const normalizedAliases = {};
  for (const [language, values] of Object.entries(aliases)) {
    normalizedAliases[language] = [...new Set((values || []).map(normalize).filter(Boolean))];
  }
  return Object.freeze({
    canonicalId,
    aliases: normalizedAliases,
    sourceIds: [...new Set(sourceIds)],
    identityStableAcrossLanguages: true
  });
}

export function multilingualRetrievalPlan({
  query,
  detected,
  canonicalEntities = [],
  sourceLanguages = [],
  intent = null
} = {}) {
  const detectedLanguages = detected?.languages?.map((x) => x.language) || [];
  const queryTerms = tokenise(query);
  const aliasMatches = [];
  for (const entity of canonicalEntities) {
    const allAliases = Object.values(entity.aliases || {}).flat();
    if (queryTerms.some((term) => allAliases.includes(term))) aliasMatches.push(entity.canonicalId);
  }
  return Object.freeze({
    query,
    intent,
    queryLanguage: detected?.primary || null,
    languages: [...new Set([...detectedLanguages, ...sourceLanguages])],
    canonicalEntityIds: [...new Set(aliasMatches)],
    crossLanguageSearch: detectedLanguages.length > 0 || sourceLanguages.length > 0,
    preservesCanonicalIdentity: true
  });
}

export function createVerifiedTranslation({
  id,
  canonicalSourceId,
  language,
  text,
  translator,
  sourceId,
  state = 'machine-draft',
  reviewedAt = null
} = {}) {
  if (![id, canonicalSourceId, language, text, translator, sourceId].every((v) => String(v || '').trim())) {
    throw new TypeError('translation requires id, canonical source, language, text, translator and source');
  }
  if (!TRANSLATION_STATES.includes(state)) throw new TypeError('invalid translation state');
  if (state === 'verified' && !reviewedAt) throw new TypeError('verified translation requires review timestamp');
  return Object.freeze({
    id,
    canonicalSourceId,
    language,
    text,
    translator,
    sourceId,
    state,
    reviewedAt,
    machineGenerated: state === 'machine-draft',
    replacesOriginal:false,
    canonical:false
  });
}

export function createReligiousEvidenceRecord({
  claimId,
  sourceId,
  sourceLanguage,
  provenanceId,
  sourceKind = 'text',
  verified = false,
  authority = 'source-dependent',
  citation = null
} = {}) {
  if (![claimId, sourceId, sourceLanguage, provenanceId].every((v) => String(v || '').trim())) {
    throw new TypeError('religious evidence requires claim, source, language and provenance');
  }
  return Object.freeze({
    claimId,
    sourceId,
    sourceLanguage,
    provenanceId,
    sourceKind,
    verified: verified === true,
    authority,
    citation,
    provenanceRequired:true
  });
}

export function createMediaSource({
  id,
  kind,
  url,
  sourceLanguage = null,
  provenanceId = null,
  authority = false
} = {}) {
  if (!id || !MEDIA_KINDS.includes(kind) || !/^https?:\/\//i.test(String(url || ''))) {
    throw new TypeError('media source requires id, known kind and http(s) URL');
  }
  return Object.freeze({
    id, kind, url, sourceLanguage, provenanceId,
    scientificAuthority: authority === true && Boolean(provenanceId),
    mediaByDefault:true,
    religiousAuthorityByDefault:false
  });
}

export function evaluateEvidenceSufficiency({ evidence = [], requiredCount = 1 } = {}) {
  const valid = evidence.filter((item) => item?.verified === true && item?.provenanceRequired === true && item?.provenanceId);
  if (valid.length < requiredCount) {
    return Object.freeze({
      sufficient:false,
      state:'insufficient-evidence',
      usableEvidence:valid.length,
      requiredEvidence:requiredCount,
      responsePolicy:'state-insufficient-evidence; do-not-invent-or-upgrade'
    });
  }
  return Object.freeze({
    sufficient:true,
    state:'evidence-sufficient',
    usableEvidence:valid.length,
    requiredEvidence:requiredCount,
    responsePolicy:'answer-with-provenance'
  });
}

export function buildMultilingualResponseContext({
  query,
  detected,
  presentation,
  evidence = [],
  intent = null
} = {}) {
  const sufficiency = evaluateEvidenceSufficiency({ evidence });
  return Object.freeze({
    query,
    intent,
    language: presentation?.responseLanguage || detected?.primary || null,
    direction: presentation?.responseDirection || languageDirection(presentation?.responseLanguage),
    evidenceState: sufficiency.state,
    evidenceCount:sufficiency.usableEvidence,
    provenanceIds:evidence.map((x) => x.provenanceId).filter(Boolean),
    responsePolicy:sufficiency.responsePolicy,
    originalSourcePreserved:true,
    machineTranslationsLabeled:true
  });
}
