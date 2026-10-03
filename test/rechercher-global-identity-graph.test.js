import test from 'node:test';
import { strict as assert } from 'node:assert';
import { createSourceIdentityEngine, registerSource, resolveIdentity, deduplicateSource, canonicalSourceId } from '../src/rechercher-source-identity-engine.js';
import { createKnowledgeEvidenceGraphEngine, addSourceNode, addClaimNode, addEvidenceRelation, reviewEvidenceRelation, publishableClaim } from '../src/rechercher-knowledge-evidence-graph-engine.js';
import { createCitationReproducibilityEngine, startTrace, recordSource, recordTransformation, addCitation, closeTrace } from '../src/rechercher-citation-reproducibility-engine.js';

test('resolves identities and deduplicates manifestations without losing canonical identity', () => {
  const e = createSourceIdentityEngine();
  registerSource(e, { sourceId:'s1', provider:'library', locator:'u1', language:'ar' });
  registerSource(e, { sourceId:'s2', provider:'archive', locator:'u2', language:'ar' });
  resolveIdentity(e,'s1',{workId:'w1',confidence:0.95,basis:['catalogue']});
  deduplicateSource(e,'s2','s1');
  assert.equal(canonicalSourceId(e,'s2'),'s1');
});

test('keeps AI claims non-publishable and requires scholar-reviewed evidence plus allowed rights', () => {
  const e = createKnowledgeEvidenceGraphEngine();
  addSourceNode(e,{id:'src',sourceId:'s1',rightsStatus:'ALLOWED'});
  addClaimNode(e,{id:'c',text:'claim',evidenceState:'SOURCE_VERIFIED'});
  addEvidenceRelation(e,{id:'r',from:'c',to:'src',type:'SUPPORTED_BY',confidence:0.9});
  assert.equal(publishableClaim(e,'c'),false);
  reviewEvidenceRelation(e,'r',{reviewerRole:'SCHOLAR',decision:'SUPPORTED'});
  assert.equal(publishableClaim(e,'c'),true);
});

test('records reproducible source and transformation lineage', () => {
  const e = createCitationReproducibilityEngine();
  startTrace(e,{traceId:'t1',question:'q'});
  recordSource(e,'t1',{sourceId:'s1',contentHash:'h1',locator:'page:2'});
  recordTransformation(e,'t1',{stepId:'x1',operation:'extract',inputHashes:['h1'],outputHash:'h2'});
  addCitation(e,{citationId:'c1',traceId:'t1',sourceId:'s1',locator:'page:2'});
  const done = closeTrace(e,'t1',{outputHashes:['h2']});
  assert.deepEqual(done.outputs,['h2']);
  assert.equal(done.transformations[0].inputHashes[0],'h1');
});
