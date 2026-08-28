const REQUIRED_CAPABILITIES = [
  'sourceDiscovery',
  'provenance',
  'hadithEvidence',
  'quranAndTafsir',
  'ocr',
  'translation',
  'mediaQuality',
  'publication'
];

export function validateEngineMesh(mesh, { minimumRedundancy = 2 } = {}) {
  if (!mesh || typeof mesh !== 'object') throw new TypeError('engine mesh must be an object');
  const errors = [];
  const engines = mesh.engines ?? {};

  for (const capability of REQUIRED_CAPABILITIES) {
    const list = Array.isArray(engines[capability]) ? engines[capability] : [];
    if (list.length < minimumRedundancy) {
      errors.push(`${capability} requires at least ${minimumRedundancy} engines`);
    }
    const ids = new Set();
    for (const engine of list) {
      if (!engine?.id) errors.push(`${capability} contains an engine without id`);
      if (ids.has(engine.id)) errors.push(`${capability} contains duplicate engine id: ${engine.id}`);
      ids.add(engine.id);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function evaluatePublicationGates({ provenance, evidence, rights, schema, review }) {
  const gates = { provenance, evidence, rights, schema, review };
  const passed = Object.entries(gates)
    .filter(([key]) => key !== 'review' || review !== undefined)
    .every(([, value]) => value === true);
  return { publishable: passed, gates };
}

export function classifyDiscovery({ discovered = false, corroborated = false, scholarlyReviewed = false, rightsCleared = false } = {}) {
  if (!discovered) return 'unreviewed';
  if (!corroborated) return 'discovered';
  if (!scholarlyReviewed) return 'corroborated';
  if (!rightsCleared) return 'scholarly-reviewed';
  return 'publishable';
}
