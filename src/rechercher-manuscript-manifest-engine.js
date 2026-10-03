export function validateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return { valid: false, errors: ['manifest must be an object'] };
  if (manifest.type !== 'Manifest') errors.push('type must be Manifest');
  if (!manifest.id) errors.push('id is required');
  if (!manifest.label) errors.push('label is required');
  if (manifest.items !== undefined && !Array.isArray(manifest.items)) errors.push('items must be an array');
  for (const [index, canvas] of (manifest.items || []).entries()) {
    if (!canvas?.id) errors.push(`items[${index}].id is required`);
    if (canvas?.type && canvas.type !== 'Canvas') errors.push(`items[${index}].type must be Canvas`);
  }
  return { valid: errors.length === 0, errors };
}

export function normalizeManifest(manifest) {
  const result = structuredClone(manifest);
  result.type ||= 'Manifest';
  result.items ||= [];
  return result;
}

export function linkPassageToCanvas({ manifestId, canvasId, passageId, textRange, sourceHash } = {}) {
  if (!manifestId || !canvasId || !passageId || !textRange || !sourceHash) throw new TypeError('Passage link requires manifest, canvas, passage, range and source hash');
  return { manifestId, canvasId, passageId, textRange, sourceHash };
}
