const clone = (value) => structuredClone(value);

/**
 * Lawful provider adapter registry for @Rechercher.
 * Adapters describe public/official discovery interfaces; network fetching is
 * intentionally delegated to provider-specific callers so one failure never
 * blocks Acquisition. No access-control bypass is performed here.
 */
export const RESEARCH_PROVIDERS = Object.freeze([
  { id:'openalex', family:'SCHOLARLY_GRAPH', baseUrl:'https://api.openalex.org', engines:['WORK_SEARCH','AUTHOR_SEARCH','SOURCE_SEARCH','INSTITUTION_SEARCH','TOPIC_SEARCH','OPEN_ACCESS_DISCOVERY','CITATION_NEIGHBORHOOD'], freePublicApi:true },
  { id:'crossref', family:'SCHOLARLY_METADATA', baseUrl:'https://api.crossref.org', engines:['DOI_RESOLUTION','WORK_SEARCH','LICENSE_DISCOVERY','FULLTEXT_LINK_DISCOVERY','REFERENCE_METADATA','OAI_PMH_DISCOVERY'], freePublicApi:true },
  { id:'iiif', family:'DIGITAL_OBJECT', baseUrl:'https://iiif.io/api', engines:['PRESENTATION_3_MANIFEST','CANVAS_DISCOVERY','ANNOTATION_DISCOVERY','CONTENT_SEARCH','CHANGE_DISCOVERY','IMAGE_SERVICE_RESOLUTION'], freePublicApi:true },
  { id:'europeana', family:'CULTURAL_HERITAGE', baseUrl:'https://www.europeana.eu/en/apis', engines:['CATALOG_DISCOVERY','API_DISCOVERY','IIIF_MANIFEST','CONTENT_SEARCH'], freePublicApi:true },
  { id:'loc', family:'NATIONAL_LIBRARY', baseUrl:'https://www.loc.gov/apis/', engines:['CATALOG_DISCOVERY','API_DISCOVERY','IIIF_MANIFEST'], freePublicApi:true },
  { id:'open_library', family:'LIBRARY_CATALOG', baseUrl:'https://openlibrary.org/developers/api', engines:['CATALOG_DISCOVERY','WORK_IDENTITY_RECONCILIATION'], freePublicApi:true },
  { id:'internet_archive', family:'DIGITAL_LIBRARY', baseUrl:'https://archive.org/developers', engines:['CATALOG_DISCOVERY','API_DISCOVERY','OPEN_ACCESS_DISCOVERY'], freePublicApi:true },
  { id:'openiti', family:'ISLAMIC_CORPUS', baseUrl:'https://openiti.org', engines:['ISLAMIC_CORPUS_DISCOVERY','WORK_IDENTITY_RECONCILIATION','EDITION_MANIFESTATION_RECONCILIATION'], freePublicApi:true }
]);

export function createResearchProviderEngine({ providers = RESEARCH_PROVIDERS } = {}) {
  return { status:'IMPLEMENTED_FOUNDATION', providers:new Map(providers.map((p)=>[p.id,clone(p)])), traces:[], failures:[] };
}

export function getProvider(engine, providerId) {
  return engine.providers.has(providerId) ? clone(engine.providers.get(providerId)) : null;
}

export function providersForEngine(engine, engineName) {
  return [...engine.providers.values()].filter((provider)=>(provider.engines||[]).includes(engineName)).map(clone);
}

export function recordProviderAttempt(engine, { providerId, query, status='SUCCESS', candidateCount=0, error=null } = {}) {
  if (!engine.providers.has(providerId)) throw new TypeError('unknown research provider');
  const trace={ providerId, query:query||null, status, candidateCount:Number(candidateCount)||0, error:error||null, at:new Date().toISOString() };
  engine.traces.push(trace);
  if (status !== 'SUCCESS') engine.failures.push(trace);
  return clone(trace);
}

export function buildResearchFallback(engine, engineName, excluded=[]) {
  const blocked=new Set(excluded);
  return providersForEngine(engine,engineName).filter((p)=>!blocked.has(p.id)).map((p,index)=>({ attempt:index+1, providerId:p.id, baseUrl:p.baseUrl, family:p.family }));
}

export function providerHealth(engine) {
  return { status:engine.status, providers:engine.providers.size, attempts:engine.traces.length, failures:engine.failures.length };
}
