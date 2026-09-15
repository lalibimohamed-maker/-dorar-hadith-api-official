const clone = (value) => structuredClone(value);

export const DISCOVERY_ENGINES = Object.freeze([
  'IIIF_MANIFEST','PRESENTATION_3_MANIFEST','CANVAS_DISCOVERY','ANNOTATION_DISCOVERY','CONTENT_SEARCH','CHANGE_DISCOVERY',
  'WORK_SEARCH','AUTHOR_SEARCH','SOURCE_SEARCH','TOPIC_SEARCH','INSTITUTION_SEARCH','CITATION_NEIGHBORHOOD',
  'OPEN_ACCESS_DISCOVERY','DOI_RESOLUTION','LICENSE_DISCOVERY','FULLTEXT_LINK_DISCOVERY','REFERENCE_METADATA',
  'CATALOG_DISCOVERY','API_DISCOVERY','NEGATIVE_EVIDENCE_TRACKING','SOURCE_CHANGE_SYNC',
  'WORK_IDENTITY_RECONCILIATION','EDITION_MANIFESTATION_RECONCILIATION'
]);

export const SOURCE_PROVIDER_PRESETS = Object.freeze([
  { id:'openalex', type:'SCHOLARLY_GRAPH', discovery:'REST_API', engines:['WORK_SEARCH','AUTHOR_SEARCH','SOURCE_SEARCH','TOPIC_SEARCH','INSTITUTION_SEARCH','CITATION_NEIGHBORHOOD','OPEN_ACCESS_DISCOVERY','SOURCE_CHANGE_SYNC'] },
  { id:'crossref', type:'SCHOLARLY_METADATA', discovery:'REST_API', engines:['DOI_RESOLUTION','WORK_SEARCH','LICENSE_DISCOVERY','FULLTEXT_LINK_DISCOVERY','REFERENCE_METADATA'] },
  { id:'iiif_presentation', type:'IIIF_STANDARD', discovery:'PRESENTATION_3_MANIFEST', engines:['IIIF_MANIFEST','PRESENTATION_3_MANIFEST','CANVAS_DISCOVERY','ANNOTATION_DISCOVERY','CONTENT_SEARCH','CHANGE_DISCOVERY'] },
  { id:'iiif_biblissima', type:'IIIF_AGGREGATOR', discovery:'IIIF_MANIFEST', engines:['IIIF_MANIFEST','CANVAS_DISCOVERY','ANNOTATION_DISCOVERY','CONTENT_SEARCH'] },
  { id:'loc', type:'NATIONAL_LIBRARY', discovery:'API_IIIF', engines:['API_DISCOVERY','CATALOG_DISCOVERY','IIIF_MANIFEST','WORK_IDENTITY_RECONCILIATION'] },
  { id:'gallica_bnf', type:'NATIONAL_LIBRARY', discovery:'CATALOG_IIIF', engines:['CATALOG_DISCOVERY','IIIF_MANIFEST','CANVAS_DISCOVERY'] },
  { id:'digital_bodleian', type:'UNIVERSITY_LIBRARY', discovery:'IIIF', engines:['IIIF_MANIFEST','CANVAS_DISCOVERY','ANNOTATION_DISCOVERY'] },
  { id:'europeana', type:'CULTURAL_HERITAGE_AGGREGATOR', discovery:'API_IIIF', engines:['API_DISCOVERY','CATALOG_DISCOVERY','IIIF_MANIFEST','CONTENT_SEARCH'] },
  { id:'dpla', type:'CULTURAL_HERITAGE_AGGREGATOR', discovery:'API', engines:['API_DISCOVERY','CATALOG_DISCOVERY'] },
  { id:'open_library', type:'LIBRARY_CATALOG', discovery:'API', engines:['API_DISCOVERY','CATALOG_DISCOVERY','WORK_IDENTITY_RECONCILIATION'] },
  { id:'internet_archive', type:'DIGITAL_LIBRARY', discovery:'ADVANCED_SEARCH_API', engines:['API_DISCOVERY','CATALOG_DISCOVERY','OPEN_ACCESS_DISCOVERY'] },
  { id:'openiti', type:'ISLAMIC_CORPUS', discovery:'CORPUS_METADATA', engines:['CATALOG_DISCOVERY','WORK_IDENTITY_RECONCILIATION','EDITION_MANIFESTATION_RECONCILIATION'] }
]);

export function createGlobalSourceDiscoveryEngine({ providers = [], presetProviders = true } = {}) {
  const initial = presetProviders ? SOURCE_PROVIDER_PRESETS : [];
  return { status:'IMPLEMENTED_EXTENSION_POINT', providers:new Map([...initial,...providers].map(p=>[p.id,clone(p)])), candidates:new Map(), failures:[], traces:[], negativeEvidence:new Map() };
}

export function registerDiscoveryProvider(engine, provider) {
  if (!provider?.id) throw new TypeError('provider id is required');
  if (!provider?.discovery) throw new TypeError('provider discovery method is required');
  engine.providers.set(provider.id, clone(provider)); return clone(provider);
}

export function rankProviders(engine, { scope=null, engineName=null }={}) {
  return [...engine.providers.values()].filter(p=>!scope||String(p.scope||'').includes(scope)).filter(p=>!engineName||(p.engines||[]).includes(engineName)||p.discovery===engineName).sort((a,b)=>Number(b.priority||0)-Number(a.priority||0)).map(clone);
}

export function recordCandidate(engine, candidate) {
  if (!candidate?.candidateId) throw new TypeError('candidateId is required');
  if (!candidate?.providerId) throw new TypeError('providerId is required');
  if (!engine.providers.has(candidate.providerId)) throw new Error('provider not registered');
  const value={...clone(candidate),state:candidate.state||'DISCOVERED'}; engine.candidates.set(value.candidateId,value);
  engine.traces.push({type:'CANDIDATE_DISCOVERED',candidateId:value.candidateId,providerId:value.providerId}); return clone(value);
}

export function recordProviderFailure(engine, { providerId, query, reason, recoverable=true }={}) {
  if (!engine.providers.has(providerId)) throw new Error('provider not registered');
  const failure={providerId,query:query||null,reason:reason||'UNKNOWN',recoverable:Boolean(recoverable),at:new Date().toISOString()};
  engine.failures.push(failure); engine.traces.push({type:'PROVIDER_FAILURE',...failure}); return clone(failure);
}

export function recordNegativeEvidence(engine, { workId, providerId, query, reason='NO_MATCH' }={}) {
  if (!workId) throw new TypeError('workId is required'); if (!providerId) throw new TypeError('providerId is required');
  if (!engine.providers.has(providerId)) throw new Error('provider not registered');
  const record={workId,providerId,query:query||null,reason,at:new Date().toISOString()}; engine.negativeEvidence.set(`${workId}:${providerId}`,record);
  engine.traces.push({type:'NEGATIVE_EVIDENCE_RECORDED',...record}); return clone(record);
}

export function buildFallbackPlan(engine, { scope=null, engineName=null, excludeProviderIds=[] }={}) {
  const excluded=new Set(excludeProviderIds);
  return rankProviders(engine,{scope,engineName}).filter(p=>!excluded.has(p.id)).map((p,i)=>({attempt:i+1,providerId:p.id,discovery:p.discovery,engines:p.engines||[],download:p.download||'SOURCE_DEPENDENT',rights:p.rights||'SOURCE_RECORD'}));
}

export function scoreCandidate(candidate) {
  if (!candidate) return 0;
  const factors=[['completeness',.20],['resolution',.15],['pageLegibility',.15],['bibliographicIdentity',.15],['sourceStability',.10],['provenanceStrength',.10],['rightsClarity',.10],['textExtractability',.05]];
  return Math.round(factors.reduce((sum,[key,weight])=>sum+Math.max(0,Math.min(1,Number(candidate[key]??0)))*weight,0)*1000)/10;
}

export function bestCandidate(engine, candidates=[]) {
  const verified=candidates.filter(c=>c&&c.verified&&c.publishable!==false);
  return verified.sort((a,b)=>Number(b.qualityScore??scoreCandidate(b))-Number(a.qualityScore??scoreCandidate(a)))[0]||null;
}

export function discoveryHealth(engine) {
  return {status:engine.status,providers:engine.providers.size,candidates:engine.candidates.size,failures:engine.failures.length,negativeEvidence:engine.negativeEvidence.size,traces:engine.traces.length,engines:DISCOVERY_ENGINES.length};
}
