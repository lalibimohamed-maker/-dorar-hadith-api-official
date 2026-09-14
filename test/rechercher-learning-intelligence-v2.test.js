import test from 'node:test';
import assert from 'node:assert/strict';
import { createLearnerState, diagnose, selectMethod, scoreLearningItem, selectNextItem, updateLearnerState, buildLearningCycle, canLearningBlockAcquisition, validateLearningItem } from '../src/learning/rechercher-learning-intelligence-v2.mjs';

test('diagnoses overconfidence and prerequisite gaps',()=>{
  const state=createLearnerState({skills:{prayer:{mastery:.7,retrievability:.5,confidence:.8}}});
  assert.equal(diagnose({state,skillId:'prayer',correct:false,confidence:.9}),'overconfidence');
  assert.equal(diagnose({state,skillId:'prayer',correct:false,confidence:.2,prerequisiteSatisfied:false}),'prerequisite-gap');
});

test('selects a targeted method',()=>{
  assert.equal(selectMethod({diagnosis:'misconception'}),'worked-example');
  assert.equal(selectMethod({diagnosis:'transfer-gap'}),'transfer-case');
});

test('ranks items by learning value and updates state',()=>{
  const state=createLearnerState({skills:{a:{mastery:.1,retrievability:.1,confidence:.5},b:{mastery:.9,retrievability:.9,confidence:.9}}});
  const chosen=selectNextItem([{id:'a',skillIds:['a']},{id:'b',skillIds:['b']}],state);
  assert.equal(chosen.item.id,'a');
  const next=updateLearnerState(state,{skillId:'a',correct:true,confidence:.6});
  assert.ok(next.skills.a.mastery>state.skills.a.mastery);
});

test('runs feedback, spacing, retest and transfer cycle',()=>{
  const state=createLearnerState({skills:{x:{mastery:.3,retrievability:.2,confidence:.4}}});
  const cycle=buildLearningCycle({item:{skillIds:['x'],transferPrompt:'Apply the concept in a new case'},state,result:{correct:false,confidence:.9},evidence:[{sourceId:'s1',passageId:'p1',claim:'verified claim'}]});
  assert.equal(cycle.diagnosis,'overconfidence');
  assert.equal(cycle.phase,'repair-retest');
  assert.equal(cycle.acquisitionIndependent,true);
  assert.equal(cycle.feedback.sourceGrounded,true);
  assert.equal(cycle.transfer.delayed,true);
});

test('learning engine cannot block acquisition and enforces source/rights boundaries',()=>{
  assert.equal(canLearningBlockAcquisition(),false);
  assert.equal(validateLearningItem({sourceIds:['s'],sourceVerified:true,rightsStatus:'unknown',publication:false}).ok,true);
  assert.equal(validateLearningItem({sourceVerified:false}).ok,false);
});
