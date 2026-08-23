export function normalizeNarratorName(name = '') {
  return String(name)
    .normalize('NFKC')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateNarratorRelation(relation = {}) {
  const errors = [];
  for (const field of ['fromNarratorId', 'toNarratorId', 'relationType', 'sourceId', 'reference']) {
    if (!relation[field]) errors.push(`missing:${field}`);
  }
  if (!['teacher', 'student', 'transmission'].includes(relation.relationType)) {
    errors.push(`unsupported-relation-type:${relation.relationType}`);
  }
  if (relation.fromNarratorId === relation.toNarratorId) errors.push('self-relation');
  return { valid: errors.length === 0, errors };
}

export function buildNarratorRelation(input = {}) {
  const relation = {
    relationId: input.relationId || `${input.relationType}:${input.fromNarratorId}:${input.toNarratorId}:${input.sourceId}:${input.reference}`,
    fromNarratorId: input.fromNarratorId,
    toNarratorId: input.toNarratorId,
    relationType: input.relationType,
    sourceId: input.sourceId,
    reference: input.reference,
    evidenceText: input.evidenceText || null,
    verificationState: input.verificationState || 'pending_review'
  };
  const result = validateNarratorRelation(relation);
  if (!result.valid) throw new TypeError(`Invalid narrator relation: ${result.errors.join(', ')}`);
  return relation;
}

export function getNarratorNetwork(narratorId, relations = []) {
  const id = String(narratorId || '');
  return {
    narratorId: id,
    teachers: relations.filter((r) => r.toNarratorId === id && r.relationType === 'teacher'),
    students: relations.filter((r) => r.fromNarratorId === id && r.relationType === 'student'),
    transmissions: relations.filter((r) => (r.fromNarratorId === id || r.toNarratorId === id) && r.relationType === 'transmission')
  };
}

export function validateChain(chain = [], relations = []) {
  const errors = [];
  for (let i = 0; i < chain.length - 1; i += 1) {
    const from = chain[i];
    const to = chain[i + 1];
    const supported = relations.some((r) =>
      r.fromNarratorId === from && r.toNarratorId === to &&
      (r.relationType === 'teacher' || r.relationType === 'transmission')
    );
    if (!supported) errors.push({ fromNarratorId: from, toNarratorId: to, reason: 'no-linked-evidence' });
  }
  return { valid: errors.length === 0, errors, chain: [...chain] };
}
