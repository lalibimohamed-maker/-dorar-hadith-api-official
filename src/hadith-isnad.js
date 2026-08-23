const REQUIRED_NARRATOR_FIELDS = ['id', 'name'];
const REQUIRED_ISNAD_FIELDS = ['id', 'narratorIds'];

export function validateNarrator(narrator = {}) {
  const errors = [];
  for (const field of REQUIRED_NARRATOR_FIELDS) {
    if (narrator[field] == null || narrator[field] === '') errors.push(`narrator:missing:${field}`);
  }
  if (narrator.grades && !Array.isArray(narrator.grades)) errors.push('narrator:grades-not-array');
  return { valid: errors.length === 0, errors };
}

export function validateIsnad(isnad = {}, narratorRegistry = new Map()) {
  const errors = [];
  for (const field of REQUIRED_ISNAD_FIELDS) {
    if (isnad[field] == null) errors.push(`isnad:missing:${field}`);
  }
  if (!Array.isArray(isnad.narratorIds)) errors.push('isnad:narratorIds-not-array');
  else {
    for (const id of isnad.narratorIds) {
      if (!narratorRegistry.has(id)) errors.push(`isnad:narrator-not-registered:${id}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function createNarratorRegistry(narrators = []) {
  const registry = new Map();
  for (const narrator of narrators) registerNarrator(registry, narrator);
  return registry;
}

export function registerNarrator(registry, narrator) {
  const result = validateNarrator(narrator);
  if (!result.valid) throw new TypeError(`Invalid narrator: ${result.errors.join(',')}`);
  if (registry.has(narrator.id)) throw new TypeError(`Duplicate narrator: ${narrator.id}`);
  registry.set(narrator.id, structuredClone(narrator));
  return narrator.id;
}

export function getNarrator(registry, id) {
  return registry.get(id) || null;
}

export function createIsnad(registry, isnad) {
  const result = validateIsnad(isnad, registry);
  if (!result.valid) throw new TypeError(`Invalid isnad: ${result.errors.join(',')}`);
  return structuredClone(isnad);
}

export function summarizeNarratorEvidence(narrator) {
  const grades = Array.isArray(narrator?.grades) ? narrator.grades : [];
  return {
    narratorId: narrator?.id ?? null,
    gradeCount: grades.length,
    sources: [...new Set(grades.map(g => g?.sourceId).filter(Boolean))]
  };
}
