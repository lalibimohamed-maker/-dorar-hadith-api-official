import test from 'node:test';
import assert from 'node:assert/strict';
import { createV6GlobalSourceIntelligenceEngine, discoverSource, resolveSourceIdentity, evaluateRights, verifySource } from '../src/rechercher-v6-global-source-intelligence-engine.js';
import { createRuntime, createV7GraphIntegrationStageNodeContract, ingestClaim, ingestEvidence, ingestContradiction, alignLanguages, buildIntegratedResearchGraph, search, health } from '../src/rechercher-v7-graph-integration-engine.js';

const provenance={sourceIds:['source-1'],locator:'page:12'};
function verifiedSourceEngine(rightsState='ALLOWED') {
  const engine=createV6GlobalSourceIntelligenceEngine();
  discoverSource(engine,{candidateId:'candidate-1',sourceUrl:'https://example.org/book.pdf',sourceType:'DIGITAL_BOOK',provenance,rightsState:'UNKNOWN'});
  resolveSourceIdentity(engine,'candidate-1',{sourceId:'source-1'});
  evaluateRights(engine,'candidate-1',rightsState,{kind:'rights-record',recordId:'rights-1'});
  verifySource(engine,'candidate-1');
  return engine;
}

test('V7.2 exposes a validated stage contract',()=>{
  const contract=createV7GraphIntegrationStageNodeContract();
  assert.equal(contract.stageId,'V7_GRAPH_INTEGRATION');
  assert.ok(contract.capabilities.includes('RIGHTS_AWARE_GRAPH_SEARCH'));
  assert.equal(contract.safety.canMutateOriginalPdf,false);
  assert.equal(contract.rightsPolicy.unknownIsPublishable,false);
});

test('V7.2 integrates verified V6 sources into claim/evidence graph',()=>{
  const runtime=createRuntime({sourceEngine:verifiedSourceEngine()});
  ingestClaim(runtime,{claimId:'claim-1',text:'A source-grounded claim',status:'DIRECT_SOURCE',provenance});
  ingestEvidence(runtime,{evidenceId:'evidence-1',claimId:'claim-1',strength:'DIRECT',passageId:'page:12',provenance});
  const graph=buildIntegratedResearchGraph(runtime);
  assert.equal(graph.claimIds.length,1);
  assert.equal(graph.evidenceIds.length,1);
  assert.ok(graph.graphNodes.some(n=>n.nodeId==='source:source-1'));
  assert.ok(graph.graphEdges.some(e=>e.relation==='SUPPORTS'));
});

test('public search is rights-aware and excludes restricted sources',()=>{
  const allowed=createRuntime({sourceEngine:verifiedSourceEngine('ALLOWED')});
  ingestClaim(allowed,{claimId:'claim-a',text:'public knowledge',status:'DIRECT_SOURCE',provenance});
  assert.equal(search(allowed,'public knowledge').length,1);
  const restricted=createRuntime({sourceEngine:verifiedSourceEngine('RESTRICTED')});
  ingestClaim(restricted,{claimId:'claim-r',text:'restricted knowledge',status:'DIRECT_SOURCE',provenance});
  assert.equal(search(restricted,'restricted knowledge').length,0);
  assert.equal(search(restricted,'restricted knowledge',{publicOnly:false}).length,1);
});

test('contradictions remain explicit in the integrated graph',()=>{
  const runtime=createRuntime({sourceEngine:verifiedSourceEngine()});
  ingestClaim(runtime,{claimId:'left',text:'left position',status:'DIRECT_SOURCE',provenance});
  ingestClaim(runtime,{claimId:'right',text:'right position',status:'DIRECT_SOURCE',provenance});
  ingestContradiction(runtime,{contradictionId:'c-1',leftClaimId:'left',rightClaimId:'right',type:'SCHOLARLY_DISAGREEMENT',confidence:.9,provenance});
  const graph=buildIntegratedResearchGraph(runtime);
  assert.ok(graph.graphNodes.some(n=>n.nodeId==='contradiction:c-1'));
  assert.equal(graph.graphEdges.filter(e=>e.relation==='CONTRADICTS').length,2);
});

test('multilingual evidence alignment is preserved without inventing equivalence',()=>{
  const runtime=createRuntime({sourceEngine:verifiedSourceEngine()});
  ingestClaim(runtime,{claimId:'claim-ml',text:'Arabic concept',status:'DIRECT_SOURCE',provenance});
  ingestEvidence(runtime,{evidenceId:'ar',claimId:'claim-ml',strength:'DIRECT',passageId:'ar:1',provenance});
  ingestEvidence(runtime,{evidenceId:'en',claimId:'claim-ml',strength:'MODERATE',passageId:'en:1',provenance});
  const edge=alignLanguages(runtime,{alignmentId:'align-1',sourceEvidenceId:'evidence:ar',targetEvidenceId:'evidence:en',sourceLanguage:'ar',targetLanguage:'en',matchType:'NO_EXACT_EQUIVALENT',confidence:.64,provenance});
  assert.equal(edge.relation,'NO_EXACT_EQUIVALENT');
});

test('integration fails closed when source is not verified or lacks rights evidence',()=>{
  const engine=createV6GlobalSourceIntelligenceEngine();
  discoverSource(engine,{candidateId:'c',sourceUrl:'https://example.org/x',provenance});
  const runtime=createRuntime({sourceEngine:engine});
  assert.throws(()=>ingestClaim(runtime,{claimId:'x',text:'x',status:'DIRECT_SOURCE',provenance}),/verified source/);
});

test('health exposes graph and trace counters',()=>{
  const runtime=createRuntime({sourceEngine:verifiedSourceEngine()});
  ingestClaim(runtime,{claimId:'h',text:'health check',status:'DIRECT_SOURCE',provenance});
  const value=health(runtime);
  assert.equal(value.version,'7.2.1');
  assert.equal(value.claims,1);
  assert.ok(value.traces>=1);
});
