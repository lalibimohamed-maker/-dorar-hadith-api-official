import test from 'node:test';
import assert from 'node:assert/strict';
import {
  V3_VERSION,
  createGraphState,
  addGraphNode,
  addGraphEdge,
  prerequisiteGaps,
  rankPrerequisiteHypotheses,
  diagnoseMisconception,
  validateGraphEdge,
  calibrate,
  updateCalibrationState,
  createLearnerProfile,
  createMultimodalProfile,
  classifyLearningFailure,
  validateMethod,
  registerMethod,
  METHOD_REGISTRY,
  recordMethodOutcome,
  evaluateMethod,
  createAblationPlan,
  evaluateAblation,
  buildEvidenceTrace,
  validateEvidenceTrace,
  createLearningObject,
  invalidateLearningObject,
  buildProgressiveExplanation,
  buildTransferTask,
  evaluateTransfer,
  buildV3Decision,
  buildAiTaskConstraints,
  getV3Capabilities,
  canLearningBlockAcquisition,
} from '../src/learning/rechercher-learning-intelligence-v3.mjs';

const provenance = { sourceId:'source-1', page:12 };

test('v3 graph requires provenance for source-grounded relations', () => {
  let g = createGraphState();
  g = addGraphNode(g, { id:'pre', type:'concept' });
  g = addGraphNode(g, { id:'skill', type:'concept' });
  assert.equal(validateGraphEdge({ from:'pre', to:'skill', relation:'requires' }).ok, false);
  g = addGraphEdge(g, { from:'pre', to:'skill', relation:'requires', confidence:0.9, provenance, status:'verified' });
  assert.equal(g.edges.length, 1);
});

test('v3 distinguishes prerequisite direction and ranks gaps', () => {
  let g = createGraphState();
  g = addGraphNode(g, { id:'pre', type:'concept' });
  g = addGraphNode(g, { id:'skill', type:'concept' });
  g = addGraphEdge(g, { from:'pre', to:'skill', relation:'requires', confidence:0.95, provenance, status:'verified' });
  g = addGraphEdge(g, { from:'pre', to:'skill', relation:'prerequisite_of', confidence:0.9, provenance, status:'verified' });
  const state = { skills:{ pre:{ mastery:0.2 } } };
  assert.equal(prerequisiteGaps(g, state, 'skill')[0].conceptId, 'pre');
  assert.equal(rankPrerequisiteHypotheses(g, state, 'skill')[0].routePriority, 1);
});

test('v3 keeps misconception as a hypothesis', () => {
  let g = createGraphState();
  g = addGraphNode(g, { id:'skill', type:'concept' });
  g = addGraphNode(g, { id:'mis', type:'misconception' });
  g = addGraphEdge(g, { from:'skill', to:'mis', relation:'confused_with', confidence:0.8, provenance, status:'candidate' });
  const result = diagnoseMisconception(g, { misconceptions:{ mis:true } }, 'skill', { correct:false });
  assert.equal(result.id, 'mis');
  assert.equal(result.status, 'candidate');
});

test('v3 calibrates confidence independently from correctness', () => {
  assert.equal(calibrate({ correct:false, confidence:0.9 }).state, 'overconfident');
  assert.equal(calibrate({ correct:true, confidence:0.1 }).state, 'underconfident');
  const state = updateCalibrationState({}, { correct:false, confidence:0.9 });
  assert.ok(state.overconfidenceRisk > 0);
});

test('v3 learner profile is multimodal and privacy-minimal', () => {
  const p = createLearnerProfile({
    skills:{ hadith:{ mastery:0.7, transfer:0.4 } },
    modalityProfile:{ audio:{ proficiency:0.7, attempts:4 }, speech:{ optedIn:true, attempts:2 } }
  });
  assert.equal(p.skills.hadith.mastery,0.7);
  assert.equal(p.modalityProfile.audio.attempts,4);
  assert.equal(p.privacy.biometricInference,false);
  assert.ok(!('biometrics' in p.modalityProfile));
});

test('v3 classifies repeated failure without conflating disagreement with misconception', () => {
  assert.equal(classifyLearningFailure({correct:false,scholarlyDisagreement:true}), 'scholarly-disagreement');
  assert.equal(classifyLearningFailure({correct:false,terminologyMismatch:true}), 'terminology-confusion');
  assert.equal(classifyLearningFailure({correct:false,sourceIdCorrect:false}), 'source-attribution-error');
});

test('v3 method registry is versioned and validates stages', () => {
  assert.equal(validateMethod({id:'x',version:'1.0.0',targets:['recall'],stages:['practice']}).ok,true);
  assert.equal(validateMethod({id:'x',version:'1.0.0',targets:['recall'],stages:['invalid']}).ok,false);
  const registry = registerMethod({}, {id:'custom',version:'1.0.0',targets:['recall'],stages:['practice'],feedbackRequired:true});
  assert.equal(registry.custom.version,'1.0.0');
  assert.ok(METHOD_REGISTRY['retrieval-practice']);
});

test('v3 evaluates outcomes without declaring a universal best method', () => {
  let r = {};
  for (let i=0;i<10;i++) r = recordMethodOutcome(r,{methodId:'retrieval-practice',immediate:0.8,delayed:0.75,transfer:0.7,timeMs:1000});
  const e = evaluateMethod(r,'retrieval-practice');
  assert.equal(e.status,'eligible-for-comparison');
  assert.equal(e.transferMean,0.7);
  assert.equal(e.noUniversalBestClaim,true);
});

test('v3 ablation plan preserves delayed and transfer outcomes', () => {
  const plan = createAblationPlan({
    studyId:'study-1',
    skillIds:['skill-1'],
    arms:[{id:'retrieval'},{id:'retrieval+feedback'}],
    minimumTrials:2
  });
  const result = evaluateAblation(plan,[
    {armId:'retrieval',immediate:0.8,delayed:0.6,transfer:0.5,confidenceError:0.1},
    {armId:'retrieval',immediate:0.7,delayed:0.5,transfer:0.4,confidenceError:0.2},
    {armId:'retrieval+feedback',immediate:0.8,delayed:0.8,transfer:0.7,confidenceError:0.1},
    {armId:'retrieval+feedback',immediate:0.9,delayed:0.7,transfer:0.8,confidenceError:0.1}
  ]);
  assert.equal(result.arms[0].eligible,true);
  assert.equal(result.arms[1].transferMean,0.75);
  assert.equal(result.noAutomaticPromotion,true);
});

test('v3 evidence trace connects learning item to source anchor and rights state', () => {
  const trace = buildEvidenceTrace({
    learningItemId:'li-1', conceptId:'concept-1', claimId:'claim-1',
    evidenceId:'evidence-1', sourceId:'source-1', editionId:'edition-1',
    anchor:'page:12', rightsStatus:'read-only', reviewState:'verified'
  });
  assert.equal(validateEvidenceTrace(trace).ok,true);
  assert.equal(trace.canonical,false);
});

test('v3 learning lifecycle supports invalidation on source changes', () => {
  const built = createLearningObject({
    itemId:'li-1',
    sourceId:'source-1',
    skillIds:['skill-1'],
    prompt:'سؤال',
    answer:'جواب',
    provenance,
    lifecycle:'source-verified',
    sourceVerified:true
  });
  assert.equal(built.validation.ok,true);
  assert.equal(invalidateLearningObject(built.object).lifecycle,'deprecated');
});

test('v3 progressive disclosure and evidence-grounded transfer exist', () => {
  const disclosure = buildProgressiveExplanation({shortAnswer:'مختصر',evidence:[provenance],explanation:'شرح',deepDive:'تفصيل'});
  assert.equal(disclosure.progressive,true);

  const transfer = buildTransferTask({
    sourceId:'source-1',
    sourceAnchor:'page:12',
    conceptIds:['concept-1'],
    prompt:'طبّق القاعدة على حالة جديدة',
    expectedEvidenceIds:['e1'],
    targetContext:'new-case',
    verifiedEvidence:true
  });
  assert.equal(transfer.ok,true);
  assert.equal(evaluateTransfer({correct:true,novelContext:true,explanationQuality:0.8,evidenceAlignment:0.8}).transferred,true);
});

test('v3 decision combines prerequisite, misconception and calibration signals', () => {
  let g = createGraphState();
  g = addGraphNode(g, { id:'pre', type:'concept' });
  g = addGraphNode(g, { id:'skill', type:'concept' });
  g = addGraphNode(g, { id:'mis', type:'misconception' });
  g = addGraphEdge(g, { from:'pre', to:'skill', relation:'requires', confidence:0.95, provenance, status:'verified' });
  g = addGraphEdge(g, { from:'skill', to:'mis', relation:'confused_with', confidence:0.8, provenance, status:'candidate' });
  const decision = buildV3Decision({
    graph:g,
    state:{skills:{pre:{mastery:0.2}},misconceptions:{mis:true},calibrationBias:0},
    skillId:'skill',
    result:{correct:false,confidence:0.9,knownMisconception:true},
    methods:['retrieval-practice'],
    methodRegistry:{},
    source:{sourceId:'source-1',anchor:'page:12'}
  });
  assert.equal(decision.diagnosis.prerequisiteGap,true);
  assert.equal(decision.diagnosis.calibration.state,'overconfident');
  assert.equal(decision.acquisitionIndependent,true);
});

test('v3 AI constraints cannot write canonical corpus', () => {
  const c = buildAiTaskConstraints({sourceIds:['s1'],evidenceIds:['e1'],allowCanonicalWrite:true});
  assert.equal(c.allowCanonicalWrite,false);
  assert.equal(c.generatedOutputIsCanonical,false);
});

test('learning/graph/evaluation failures never block PDF acquisition', () => {
  assert.equal(canLearningBlockAcquisition(),false);
  assert.equal(getV3Capabilities().acquisitionIndependent,true);
  assert.equal(V3_VERSION,'3.0.0');
});

test('v3 does not create a phantom calibration attempt when creating a learner profile', () => {
  const p = createLearnerProfile({ learnerId:'learner-1' });
  assert.equal(p.calibration.history.length, 0);
});
