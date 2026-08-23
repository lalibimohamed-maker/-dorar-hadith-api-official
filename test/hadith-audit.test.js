import assert from 'node:assert/strict';import test from 'node:test';import {auditHadithRecord} from '../src/hadith-audit.js';
test('audit flags missing provenance metadata',()=>{const r=auditHadithRecord({hadithId:'h1'});assert.equal(r.validMetadata,false);assert.ok(r.missing.includes('sourceId'));assert.equal(r.aiRequired,false);});
test('audit accepts complete metadata',()=>{const r=auditHadithRecord({hadithId:'h1',sourceId:'bukhari',reference:'1',chain:['n1']});assert.equal(r.validMetadata,true);assert.equal(r.hasChain,true);});
