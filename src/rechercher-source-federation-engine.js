export const SOURCE_ADAPTERS = Object.freeze(['OPENALEX','CROSSREF','LIBRARY_OF_CONGRESS','OPENITI','GOOGLE_BOOKS','IIIF']);

function required(value, name) {
  if (!value) throw new TypeError(`Source record requires ${name}`);
}

export function createFederationEngine({adapters = SOURCE_ADAPTERS} = {}) {
  const allowed = new Set(adapters);
  return { adapters: allowed, records: new Map(), queries: [] };
}

export function registerFederatedRecord(engine, record) {
  required(record?.sourceId, 'sourceId');
  required(record?.provider, 'provider');
  required(record?.retrievedAt, 'retrievedAt');
  required(record?.recordHash, 'recordHash');
  if (!engine.adapters.has(record.provider)) throw new TypeError(`Unsupported provider: ${record.provider}`);
  if (engine.records.has(record.sourceId)) throw new Error(`Duplicate source: ${record.sourceId}`);
  engine.records.set(record.sourceId, structuredClone(record));
  return record.sourceId;
}

export function recordFederatedQuery(engine, query) {
  required(query?.queryId, 'queryId');
  required(query?.provider, 'provider');
  required(query?.executedAt, 'executedAt');
  if (!engine.adapters.has(query.provider)) throw new TypeError(`Unsupported provider: ${query.provider}`);
  engine.queries.push(structuredClone(query));
  return query.queryId;
}

export function getFederatedSources(engine, provider) {
  return [...engine.records.values()].filter((r) => !provider || r.provider === provider);
}
