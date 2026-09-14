import test from 'node:test';
import assert from 'node:assert/strict';
import {createUnifiedScholarWorkspace,registerWorkspaceLearner,openLearningSession,linkEngineArtifact,submitWorkspaceReview,workspacePublishable} from '../src/rechercher-unified-scholar-workspace.js';

test('student workspace blocks publication until teacher or scholar review',()=>{
  const w=createUnifiedScholarWorkspace();
  registerWorkspaceLearner(w,{learnerId:'student-1',role:'STUDENT'});
  openLearningSession(w,{sessionId:'s1',learnerId:'student-1',conceptIds:['fiqh-1'],sourceIds:['book-1']});
  linkEngineArtifact(w,{linkId:'l1',sessionId:'s1',engine:'FIQH',artifactId:'position-1',sourceIds:['book-1'],reviewRequired:true});
  assert.equal(workspacePublishable(w,'s1'),false);
  assert.throws(()=>submitWorkspaceReview(w,{reviewId:'r1',linkId:'l1',reviewerId:'student-2',reviewerRole:'STUDENT',verdict:'APPROVED'}));
  submitWorkspaceReview(w,{reviewId:'r2',linkId:'l1',reviewerId:'teacher-1',reviewerRole:'TEACHER',verdict:'APPROVED'});
  assert.equal(workspacePublishable(w,'s1'),true);
});

test('revision and rejection remain publication blockers',()=>{
  const w=createUnifiedScholarWorkspace();
  registerWorkspaceLearner(w,{learnerId:'student-1'});
  openLearningSession(w,{sessionId:'s2',learnerId:'student-1'});
  linkEngineArtifact(w,{linkId:'l2',sessionId:'s2',engine:'RESEARCH',artifactId:'claim-1',sourceIds:['source-1'],reviewRequired:true});
  submitWorkspaceReview(w,{reviewId:'r3',linkId:'l2',reviewerId:'scholar-1',reviewerRole:'SCHOLAR',verdict:'NEEDS_REVISION'});
  assert.equal(workspacePublishable(w,'s2'),false);
  submitWorkspaceReview(w,{reviewId:'r4',linkId:'l2',reviewerId:'scholar-1',reviewerRole:'SCHOLAR',verdict:'REJECTED'});
  assert.equal(workspacePublishable(w,'s2'),false);
});
