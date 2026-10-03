import { createHash } from 'node:crypto';

export const BIBLIOGRAPHIC_LAYERS = Object.freeze(['WORK', 'EXPRESSION', 'MANIFESTATION', 'ITEM']);
export const TRANSLATION_RELATION = 'TRANSLATION_OF';

function stableId(parts) {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export function canonicalWorkUri({ authority = 'deen-allah', originalLanguage = 'ar', normalizedTitle, creatorAuthorityId = 'unknown' } = {}) {
  if (!normalizedTitle) throw new TypeError('normalizedTitle is required');
  return `urn:${authority}:work:${originalLanguage}:${stableId([authority, 'WORK', originalLanguage, creatorAuthorityId, normalizedTitle])}`;
}

export function createWorkIdentity(input = {}) {
  if (!input.normalizedTitle || !input.originalLanguage) throw new TypeError('normalizedTitle and originalLanguage are required');
  const canonicalUri = input.canonicalUri || canonicalWorkUri(input);
  return Object.freeze({
    layer: 'WORK', canonicalUri, originalLanguage: input.originalLanguage,
    authorizedCreatorId: input.creatorAuthorityId || 'unknown', normalizedTitle: input.normalizedTitle,
    titleVariants: [...(input.titleVariants || [])], immutableIdentity: true
  });
}

export function createExpression(input = {}) {
  if (!input.workUri || !input.language) throw new TypeError('workUri and language are required');
  return Object.freeze({ layer: 'EXPRESSION', expressionId: `urn:deen-allah:expression:${stableId([input.workUri, input.language, input.translatorAuthorityId || 'unknown', input.expressionFingerprint || 'unknown'])}`, workUri: input.workUri, language: input.language, translatorAuthorityId: input.translatorAuthorityId || null, expressionFingerprint: input.expressionFingerprint || null, immutableWorkLink: true });
}

export function createManifestation(input = {}) {
  if (!input.expressionId || !input.manifestationId) throw new TypeError('expressionId and manifestationId are required');
  return Object.freeze({ layer: 'MANIFESTATION', manifestationId: input.manifestationId, expressionId: input.expressionId, publisher: input.publisher || null, publicationDate: input.publicationDate || null, isbn: input.isbn || null, contentHash: input.contentHash || null });
}

export function createTranslationEdge({ sourceExpressionId, translatedExpressionId, sourceWorkUri, evidence } = {}) {
  if (!sourceExpressionId || !translatedExpressionId || !sourceWorkUri || !evidence) throw new TypeError('translation edge requires source, target, work URI and evidence');
  return Object.freeze({ type: TRANSLATION_RELATION, from: translatedExpressionId, to: sourceWorkUri, sourceExpressionId, evidence: structuredClone(evidence), relationIsImmutable: true });
}

export function resolveWorkIdentity(record) {
  if (!record?.canonicalUri || record.layer !== 'WORK') throw new TypeError('record is not a canonical work');
  return record.canonicalUri;
}
