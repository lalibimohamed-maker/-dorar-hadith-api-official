import test from 'node:test';
import assert from 'node:assert/strict';
import {createResearch,openCase,attachEvidence,advanceCase,addUncertainty} from '../src/rechercher-research-engine.js';

test('research advances only through evidence-backed states',()=>{const e=createResearch();openCase(e,{id:'r1',question:'What is the evidence?'});assert.throws(()=>advanceCase(e,'r1','VERIFICATION'));attachEvidence(e,{caseId:'r1',sourceId:'s1',claimId:'c1',confidence:.9});advanceCase(e,'r1','SYNTHESIS');advanceCase(e,'r1','VERIFICATION');assert.equal(e.cases.get('r1').state,'VERIFICATION');});
test('unresolved uncertainty blocks publication',()=>{const e=createResearch();openCase(e,{id:'r2',question:'Compare views'});attachEvidence(e,{caseId:'r2',sourceId:'s1',claimId:'c1'});advanceCase(e,'r2','SYNTHESIS');advanceCase(e,'r2','VERIFICATION');addUncertainty(e,'edition unresolved');assert.throws(()=>advanceCase(e,'r2','PUBLISHED'));});
