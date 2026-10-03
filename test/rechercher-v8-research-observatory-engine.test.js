import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAP_TYPES,
  createRuntime,
  createKnowledgeGap,
  addKnowledgeGap,
  observeGraph,
  deriveKnowledgeGaps,
  health,
  createV8ResearchObservatoryStageNodeContract
} from '../src/rechercher-v8-research-observatory-engine.js';

test('V8 creates provenance-backed knowledge gaps', () => {
  const gap = createKnowledgeGap({ gapId:'g1', topic:'hadith', type:'MISSING_EVIDENCE', provenance:{source:'test'} });
  assert.equal(gap.gapId, 'g1');
  assert.ok(GAP_TYPES.includes(gap.type));
  assert.deepEqual(gap.provenance, {source:'test'});
});

test('V8 observes graph coverage, rights and uncertainty without treating absence as proof', () => {
  const source = { sourceId:'s1', state:'VERIFIED_SOURCE', rightsState:'ALLOWED', publishable:true };
  const graphRuntime = {
    sourceEngine:{sources:new Map([['s1', source]])},
    claims:new Map([['c1',{claimId:'c1'}],['c2',{claimId:'c2'}]]),
    evidences:new Map([['e1',{evidenceId:'e1',reviewState:'SCHOLAR_REVIEWED'}]]),
    contradictions:new Map()
  };
  const runtime = createRuntime({graphRuntime});
  const observation = observeGraph(runtime, {topic:'hadith'});
  assert.equal(observation.counts.claims, 2);
  assert.equal(observation.counts.publicSources, 1);
  assert.ok(observation.scores.uncertainty > 0);
  assert.ok(observation.scores.uncertainty <= 1);
});

test('V8 derives explicit unresolved research gaps', () => {
  const runtime = createRuntime({graphRuntime:{claims:new Map([['c1',{}]]),evidences:new Map(),contradictions:new Map(),sourceEngine:{sources:new Map()}}});
  const gaps = deriveKnowledgeGaps(runtime, {topic:'fiqh'});
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].type, 'MISSING_EVIDENCE');
  assert.equal(runtime.gaps.size, 1);
});

test('V8 health exposes observable counters and stage contract', () => {
  const runtime = createRuntime();
  addKnowledgeGap(runtime, {gapId:'g1',topic:'quran',type:'REVIEW_PENDING',provenance:{source:'test'}});
  const result = health(runtime);
  assert.equal(result.version, '8.0.0');
  assert.equal(result.gaps, 1);
  const contract = createV8ResearchObservatoryStageNodeContract();
  assert.equal(contract.stageId, 'V8_RESEARCH_OBSERVATORY');
  assert.equal(contract.version, '1.0');
  assert.ok(contract.capabilities.includes('KNOWLEDGE_GAP_INTELLIGENCE'));
});
