import { SEARCH_STAGES, registerSearch, recordSearchResult, advanceSearchStage, publishableResults } from './rechercher-global-knowledge-search-engine.js';
import { createResearchFoundationEngine, setRights, publishableSource } from './rechercher-v5-research-foundation-engine.js';
import { createCognitiveLearningEngine, startCognitiveSession, processCognitiveAttempt, buildCognitivePlan, selectKnowledgeGapAction } from './rechercher-cognitive-learning-engine.js';

export const NETWORK_STAGES = Object.freeze(['V1_FOUNDATION','V2_FEDERATION','V3_DOMAIN_LEARNING','V4_LEARNING_INTELLIGENCE','V5_GLOBAL_RESEARCH']);
export const HANDOFFS = Object.freeze(['DISCOVERY_TO_IDENTITY','IDENTITY_TO_PROVENANCE','PROVENANCE_TO_RIGHTS','RIGHTS_TO_EVIDENCE','EVIDENCE_TO_LEARNING','LEARNING_TO_RESEARCH','RESEARCH_TO_REPLAN']);
export const CONTRACT_VERSION = '1.0';

const STAGE_ORDER = new Map(NETWORK_STAGES.map((stage, index) => [stage, index]));
function requireId(value, name) { if (!value) throw new TypeError(`${name} is required`); }
function clone(value) { return structuredClone(value); }

export function stageNumber(stageId) {
  const match = /^V(\d+)/.exec(stageId || '');
  return match ? Number(match[1]) : null;
}

export function stageClass(stageId) {
  const n = stageNumber(stageId);
  if (n === null) return 'UNKNOWN';
  if (n <= 5) return 'CORE_V1_V5';
  if (n <= 20) return 'V6_V20';
  if (n <= 30) return 'V21_V30';
  return 'V31_PLUS';
}

export function validateStageNodeContract(node) {
  for (const key of ['stageId','version','capabilities','acceptedInputs','producedOutputs','requiredEvidence','rightsPolicy','reviewPolicy','dependencies','handoffs']) if (!node?.[key]) throw new TypeError(`${key} is required`);
  if (!/^\d+\.\d+$/.test(node.version)) throw new TypeError('invalid version');
  if (!Array.isArray(node.capabilities) || !node.capabilities.length) throw new TypeError('capabilities required');
  if (!Array.isArray(node.acceptedInputs) || !Array.isArray(node.producedOutputs) || !Array.isArray(node.dependencies) || !Array.isArray(node.handoffs)) throw new TypeError('invalid contract arrays');
  if (!['ALLOWED','RESTRICTED','UNKNOWN','EXPLICIT_PERMISSION_REQUIRED'].includes(node.rightsPolicy.defaultState)) throw new TypeError('invalid rights state');
  const safety = node.safety || {};
  if (safety.canOverrideRights || safety.canMutateSourceIdentity || safety.canMutateContentHash || safety.canMutateCanonicalQuranArabic || safety.canMutateOriginalPdf) throw new Error('immutable safety invariant violated');
  if (stageClass(node.stageId) === 'CORE_V1_V5' && node.status !== 'IMPLEMENTED') throw new Error('core V1-V5 nodes must remain implemented');
  return true;
}

export function createStageNodeContract(input) {
  const node = {
    contractVersion: CONTRACT_VERSION,
    status: stageClass(input.stageId) === 'CORE_V1_V5' ? 'IMPLEMENTED' : 'OPEN_EXTENSION_POINT',
    safety: { canOverrideRights:false, canMutateSourceIdentity:false, canMutateContentHash:false, canMutateCanonicalQuranArabic:false, canMutateOriginalPdf:false, acquisitionIndependent:true, ...(input.safety || {}) },
    ...input
  };
  validateStageNodeContract(node);
  return Object.freeze(clone(node));
}

export function assertNodeCompatibility(producer, consumer) {
  validateStageNodeContract(producer); validateStageNodeContract(consumer);
  const produced = new Set(producer.producedOutputs.map(x => x.type));
  const missing = consumer.acceptedInputs.map(x => x.type).filter(x => !produced.has(x));
  if (missing.length) throw new Error(`handoff contract mismatch: ${missing.join(',')}`);
  return true;
}

export function createFiveStageNetwork({ search = {}, foundation = createResearchFoundationEngine(), cognitive = createCognitiveLearningEngine(), federation = null, domain = null, learningIntelligence = null, observability = null } = {}) {
  return { search, foundation, cognitive, federation, domain, learningIntelligence, observability, state:'V1_FOUNDATION', handoffs:[], traces:[], gaps:[], outputs:new Map(), nodes:new Map(), traceSequence:0, replanCount:0 };
}

export function registerNetworkNode(network, node) {
  validateStageNodeContract(node);
  if (network.nodes.has(node.stageId)) throw new Error('stage node already registered');
  network.nodes.set(node.stageId, clone(node));
  recordNetworkTrace(network, 'NODE_REGISTERED', { stageId:node.stageId, status:node.status });
  return clone(node);
}

export function registerFutureStage(network, node) {
  const classification = stageClass(node.stageId);
  if (classification === 'CORE_V1_V5') throw new Error('use built-in V1-V5 registration');
  return registerNetworkNode(network, { ...node, status:'OPEN_EXTENSION_POINT' });
}

export function registerBuiltInNetworkNodes(network) {
  const definitions = [
    ['V1_FOUNDATION',['DISCOVERY','IDENTITY','PROVENANCE','EVIDENCE'],[],['STAGE_OUTPUT']],
    ['V2_FEDERATION',['SOURCE_FEDERATION','MULTILINGUAL_CONCEPTS','REPRODUCIBILITY'],['STAGE_OUTPUT'],['STAGE_OUTPUT']],
    ['V3_DOMAIN_LEARNING',['QURAN','HADITH','FIQH','TAFSIR','SIRAH','ARABIC','RECITATION'],['STAGE_OUTPUT'],['STAGE_OUTPUT']],
    ['V4_LEARNING_INTELLIGENCE',['ACTIVE_RECALL','ADAPTIVE_LEARNING','MASTERY','GAP_ACTIONS'],['STAGE_OUTPUT'],['STAGE_OUTPUT']],
    ['V5_GLOBAL_RESEARCH',['GLOBAL_DISCOVERY','MANUSCRIPT','EDITION','OCR','IIIF','EVIDENCE_SYNTHESIS'],['STAGE_OUTPUT'],['RESEARCH_OUTPUT']]
  ];
  for (const [stageId,capabilities,acceptedInputs,producedOutputs] of definitions) registerNetworkNode(network, createStageNodeContract({ stageId, version:'1.0', capabilities, acceptedInputs:acceptedInputs.map(type=>({type})), producedOutputs:producedOutputs.map(type=>({type})), requiredEvidence:[{type:'SOURCE_IDENTITY'},{type:'CONTENT_HASH'},{type:'RIGHTS_STATE'}], rightsPolicy:{defaultState:'UNKNOWN',publishableState:'ALLOWED'}, reviewPolicy:{scholarlyVerification:true}, dependencies:[], handoffs:acceptedInputs, tracePolicy:{traceIdRequired:true}, status:'IMPLEMENTED' }));
  return [...network.nodes.keys()];
}

export function registerNetworkQuery(network, query) {
  requireId(query?.queryId,'queryId'); registerSearch(network.search, query); recordNetworkTrace(network,'QUERY_REGISTERED',{queryId:query.queryId,stage:'V1_FOUNDATION'}); return clone(network.search.queries.get(query.queryId));
}

export function registerNetworkResult(network, result) { const value=recordSearchResult(network.search,result); recordNetworkTrace(network,'RESULT_REGISTERED',{resultId:value.resultId,queryId:value.queryId,sourceId:value.sourceId}); return value; }
export function advanceNetworkSearch(network, queryId, stage) { const value=advanceSearchStage(network.search,queryId,stage); recordNetworkTrace(network,'SEARCH_STAGE',{queryId,stage:value}); return value; }

export function verifyNetworkSource(network, {sourceId,identityState='VERIFIED',rightsState='UNKNOWN',provenanceVerified=false,reviewerRole=null}={}) {
  requireId(sourceId,'sourceId'); const source=network.foundation.sources.get(sourceId); if(!source) throw new Error('source not registered');
  source.provenanceVerified=Boolean(provenanceVerified); source.identityState=identityState;
  if(rightsState!=='UNKNOWN') setRights(network.foundation,sourceId,rightsState,source.permissionEvidence ?? null);
  source.identityReviewerRole=reviewerRole; recordNetworkTrace(network,'SOURCE_VERIFIED',{sourceId,identityState,rightsState,reviewerRole}); return clone(source);
}

export function connectHandoff(network, from, to, payload = {}) {
  const fromIndex=STAGE_ORDER.get(from), toIndex=STAGE_ORDER.get(to);
  if(fromIndex===undefined || toIndex===undefined) throw new RangeError('unknown network stage');
  if(toIndex<fromIndex) throw new RangeError('network stage cannot move backwards');
  if(from!==to && network.nodes.size && network.nodes.has(from) && network.nodes.has(to)) assertNodeCompatibility(network.nodes.get(from),network.nodes.get(to));
  const traceId=payload.traceId || createTraceId(network); const handoff={id:`handoff-${network.handoffs.length+1}`,from,to,payload:clone({...payload,traceId})};
  network.handoffs.push(handoff); network.state=to; recordNetworkTrace(network,'HANDOFF',handoff,traceId); return clone(handoff);
}

export function startNetworkLearning(network,{sessionId,learnerId,itemId,sourceIds=[]}={}) { const session=startCognitiveSession(network.cognitive,{sessionId,learnerId,itemId,sourceIds}); connectHandoff(network,'V3_DOMAIN_LEARNING','V4_LEARNING_INTELLIGENCE',{sessionId,sourceIds}); return clone(session); }

export function processNetworkAttempt(network,sessionId,attempt,options={}) {
  const result=processCognitiveAttempt(network.cognitive,sessionId,attempt,options);
  const gapAction=selectKnowledgeGapAction({needsSource:result.decision?.sourceIds?.length===0,lowRetrieval:result.diagnosis?.retrievalFailure===true,lowTransfer:result.diagnosis?.transferFailure===true,overload:result.diagnosis?.overload===true,needsReflection:result.diagnosis?.needsReflection===true});
  const output={...result,gapAction}; network.gaps.push({sessionId,gapAction,at:new Date().toISOString()}); network.outputs.set(sessionId,output); recordNetworkTrace(network,'LEARNING_FEEDBACK',{sessionId,gapAction}); connectHandoff(network,'V4_LEARNING_INTELLIGENCE','V5_GLOBAL_RESEARCH',{sessionId,gapAction}); return clone(output);
}

export function requestReplan(network, reason, context = {}) {
  network.replanCount += 1; const traceId=context.traceId || createTraceId(network); const event={reason,context:clone(context),traceId,replanCount:network.replanCount,fromStage:network.state}; network.traces.push({type:'REPLAN_REQUESTED',...event}); return clone(event);
}

export function buildNetworkPlan(network,options={}) { const plan=buildCognitivePlan(network.cognitive,options); const publishable=options.queryId?publishableResults(network.search,options.queryId):[]; const sourceIds=options.sourceIds ?? []; const rights=sourceIds.map(sourceId=>({sourceId,publishable:publishableSource(network.foundation,sourceId)})); const output={plan,publishableResults:publishable,sourceRights:rights,networkStage:network.state,replanCount:network.replanCount}; network.outputs.set(`plan:${options.learnerId ?? 'unknown'}:${options.conceptId ?? 'unknown'}`,output); recordNetworkTrace(network,'NETWORK_PLAN_BUILT',{learnerId:options.learnerId,conceptId:options.conceptId,sourceIds}); return clone(output); }

export function createTraceId(network) { network.traceSequence += 1; return `rechercher-trace-${network.traceSequence}`; }
export function recordNetworkTrace(network,type,payload={},traceId=null) { const id=traceId || createTraceId(network); const event={traceId:id,type,at:new Date().toISOString(),...clone(payload)}; network.traces.push(event); if(network.observability?.record) network.observability.record(event); return id; }
export function networkObservability(network) { return {traceCount:network.traces.length,replanCount:network.replanCount,lastTrace:network.traces.at(-1) || null}; }

export function networkHealth(network) { const verifiedSources=[...network.foundation.sources.values()].filter(source=>source.provenanceVerified).length; const allowedSources=[...network.foundation.sources.keys()].filter(sourceId=>publishableSource(network.foundation,sourceId)).length; return {state:network.state,searches:network.search.queries?.size ?? 0,results:network.search.results?.size ?? 0,verifiedSources,allowedSources,handoffs:network.handoffs.length,traces:network.traces.length,gaps:network.gaps.length,replans:network.replanCount,nodes:network.nodes.size,searchStages:[...SEARCH_STAGES]}; }

export function assertNetworkContract(network) { const health=networkHealth(network); if(health.state!=='V5_GLOBAL_RESEARCH') throw new Error('five-stage network has not reached V5'); if(health.handoffs===0) throw new Error('no stage handoffs recorded'); if(health.nodes<5) throw new Error('built-in V1-V5 nodes are not registered'); return health; }
