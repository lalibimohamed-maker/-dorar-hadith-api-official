export const RO_CRATE_ENGINE_VERSION = '1.0.0';

export function createResearchObjectCrate({ crateId, name, entities = [], provenance = [], workflows = [] } = {}) {
  if (!crateId) throw new TypeError('crateId is required');
  return {
    '@context': 'https://w3id.org/ro/crate/1.2/context',
    '@graph': [
      { '@id': 'ro-crate-metadata.json', '@type': 'CreativeWork', conformsTo: { '@id': 'https://w3id.org/ro/crate/1.2' } },
      { '@id': crateId, '@type': 'Dataset', name: name ?? crateId, hasPart: entities.map(e => ({ '@id': e.id })) },
      ...entities.map(e => ({ '@id': e.id, '@type': e.type ?? 'File', name: e.name ?? e.id, contentHash: e.contentHash ?? null })),
      ...provenance.map(p => ({ '@id': p.id, '@type': 'CreateAction', description: p.description ?? null, object: p.object ? { '@id': p.object } : null })),
      ...workflows.map(w => ({ '@id': w.id, '@type': 'ComputationalWorkflow', name: w.name ?? w.id })),
    ],
  };
}
