import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoleEngine,createProfile,recordAssessment,nextLearningAction,createReview,roleCapabilities} from '../src/rechercher-learning-roles-engine.js';

test('supports learner mastery and adaptive next action',()=>{const e=createRoleEngine();createProfile(e,{id:'u1',role:'LEARNER',goals:['fiqh']});recordAssessment(e,{profileId:'u1',conceptId:'c1',correct:false,confidence:.8});recordAssessment(e,{profileId:'u1',conceptId:'c2',correct:true,confidence:.2});assert.equal(nextLearningAction(e,'u1',['c1','c2']).conceptId,'c1');});
test('supports teacher and scholar capabilities',()=>{const e=createRoleEngine();createProfile(e,{id:'t1',role:'TEACHER'});createProfile(e,{id:'s1',role:'SCHOLAR'});createReview(e,{profileId:'s1',conceptId:'c1',sourceIds:['src'],status:'SCHOLAR_REVIEWED'});assert.ok(roleCapabilities('TEACHER').includes('diagnose'));assert.ok(roleCapabilities('SCHOLAR').includes('compare-evidence'));});
