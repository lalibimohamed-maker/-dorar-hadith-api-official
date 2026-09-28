import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMemoryState,
  recordFeedbackSignal,
  feedbackBufferStatus,
  summarizeSession,
  discardSessionMemory,
  createCrossDomainGraph,
  addCrossDomainEdge,
  validateCrossDomainEdge,
  findTransferRoutes,
  evaluateTransfer,
  compareSourceAndTransferMastery,
  applyPedagogicalSafety,
  canPersistRawFeedbackDiary,
  canLearningBlockAcquisition,
  getV4Capabilities
} from '../src/learning/rechercher-learning-intelligence-v4.mjs';

const provenance = { sourceId:'source-1', page:12 };

test('v4 separates ephemeral session memory from long-term learner memory', () => {
  let memory = createMemoryState({ session:{sessionId:'s1',currentSkillId:'hadith'}, longTerm:{learnerId:'u1'} });
  memory = recordFeedbackSignal(memory,{type:'hesitation',skillId:'hadith',value:1});
  memory = summarizeSession(memory,{skillId:'hadith',mastery:0.72,confidence:0.8,calibration:{state:'calibrated'}});
  assert.equal(memory.session.recentSignals.length,0);
  assert.equal(memory.longTerm.skills.hadith.mastery,0.72);
  assert.equal(memory.longTerm.calibration.state,'calibrated');
});

test('v4 session discard preserves only summarized long-term state', () => {
  let memory=createMemoryState({longTerm:{learnerId:'u1',skills:{a:{mastery:0.8}}}});
  memory=recordFeedbackSignal(memory,{type:'pause',itemId:'q1',value:3000});
  const discarded=discardSessionMemory(memory);
  assert.equal(discarded.session,null);
  assert.equal(discarded.longTerm.skills.a.mastery,0.8);
});

test('v4 feedback buffer is bounded and not a raw persistent diary', () => {
  let memory=createMemoryState();
  for(let i=0;i<70;i+=1) memory=recordFeedbackSignal(memory,{type:'pause',value:i});
  const status=feedbackBufferStatus(memory);
  assert.equal(status.size,50);
  assert.equal(status.maxSize,50);
  assert.equal(status.rawDiaryPersisted,false);
  assert.equal(canPersistRawFeedbackDiary(),false);
});

test('v4 cross-domain transfer edges require evidence and provenance', () => {
  const graph=createCrossDomainGraph({
    domains:{quran:{},arabic:{}},
    skills:{tajweed:{domain:'quran'},phonology:{domain:'arabic'}}
  });
  assert.equal(validateCrossDomainEdge({from:'tajweed',to:'phonology',relation:'supports'}).ok,false);
  const next=addCrossDomainEdge(graph,{
    from:'tajweed',to:'phonology',
    sourceSkillId:'tajweed',targetSkillId:'phonology',
    relation:'supports',confidence:0.9,evidence:['e1'],provenance
  });
  assert.equal(findTransferRoutes(next,'tajweed','arabic')[0].confidence,0.9);
});

test('v4 transfer evaluation stays separate from source-domain mastery', () => {
  const result=evaluateTransfer({
    sourceSkill:'tajweed',
    targetSkill:'phonology',
    sourceMastery:0.95,
    targetMasteryBefore:0.2,
    result:{correct:true,score:0.8,sourceGrounded:true},
    confidence:0.7
  });
  assert.equal(result.status,'demonstrated');
  assert.equal(result.sourceMasteryDistinctFromTransfer,true);
  assert.equal(compareSourceAndTransferMastery({sourceMastery:0.95,transferScore:0.8}).transferGap,0.15);
});

test('v4 scaffold-first safety preserves learner agency and source/rights gates', () => {
  const blocked=applyPedagogicalSafety({
    response:'answer',
    learnerState:{struggling:true},
    context:{directAnswer:true,sourceGrounded:true,rightsAware:true}
  });
  assert.equal(blocked.action,'scaffold-first');
  assert.equal(blocked.avoidDirectAnswer,true);
  assert.equal(blocked.allowed,false);

  const ready=applyPedagogicalSafety({
    response:'hint',
    learnerState:{struggling:true},
    context:{directAnswer:true,scaffolded:true,sourceGrounded:true,rightsAware:true},
    source:{sourceId:'source-1',anchor:'page:12'}
  });
  assert.equal(ready.allowed,true);
  assert.equal(ready.preserveAgency,true);

  const missingSource=applyPedagogicalSafety({
    response:'جواب ديني',
    context:{religiousContent:true,sourceGrounded:true,rightsAware:true}
  });
  assert.equal(missingSource.allowed,false);
});

test('v4 capabilities preserve acquisition independence', () => {
  const c=getV4Capabilities();
  assert.equal(c.acquisitionIndependent,true);
  assert.equal(c.feedbackBuffer.rawDiaryPersisted,false);
  assert.equal(c.crossDomainTransfer.provenanceRequired,true);
  assert.equal(c.pedagogicalSafety.noBiometricInferenceByDefault,true);
  assert.equal(canLearningBlockAcquisition(),false);
});
