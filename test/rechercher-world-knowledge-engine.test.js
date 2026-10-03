import test from 'node:test';
import assert from 'node:assert/strict';
import { createKnowledgeEngine, registerSource, addClaim, addRelation, recordKnowledgeGap, verifyClaim, snapshotKnowledgeEngine } from '../src/rechercher-world-knowledge-engine.js';

test('registers immutable source-backed knowledge structures', () => {
  const e=createKnowledgeEngine();
  registerSource(e,{sourceId:'s1',workId:'w1',language:'ar',retrievedAt:'2026-09-14T00:00:00Z',contentHash:'sha256:x',rightsStatus:'ALLOWED'});
  addClaim(e,{claimId:'c1',text:'A source-backed claim',evidenceState:'SOURCE_VERIFIED',sourceIds:['s1']});
  addClaim(e,{claimId:'c2',text:'A derived claim',evidenceState:'DERIVED',sourceIds:['s1']});
  addRelation(e,{relationId:'r1',fromClaimId:'c1',toClaimId:'c2',type:'SUPPORTS'});
  recordKnowledgeGap(e,{gapId:'g1',description:'Missing second edition',missing:['edition']});
  assert.equal(verifyClaim(e,'c1').verified,true);
  assert.equal(snapshotKnowledgeEngine(e).works[0].manifestations[0],'s1');
});

test('blocks publication verification for restricted evidence',()=>{
  const e=createKnowledgeEngine();
  registerSource(e,{sourceId:'s2',workId:'w2',language:'ar',retrievedAt:'2026-09-14T00:00:00Z',contentHash:'sha256:y',rightsStatus:'UNKNOWN'});
  addClaim(e,{claimId:'c3',text:'Restricted claim',evidenceState:'SOURCE_VERIFIED',sourceIds:['s2']});
  assert.equal(verifyClaim(e,'c3').rightsBlocked,true);
  assert.equal(verifyClaim(e,'c3').verified,false);
});

test('never treats an AI-generated claim as verified',()=>{
  const e=createKnowledgeEngine();
  registerSource(e,{sourceId:'s3',workId:'w3',language:'fr',retrievedAt:'2026-09-14T00:00:00Z',contentHash:'sha256:z',rightsStatus:'ALLOWED'});
  addClaim(e,{claimId:'c4',text:'Generated proposal',evidenceState:'AI_GENERATED',sourceIds:['s3']});
  assert.equal(verifyClaim(e,'c4').verified,false);
});
