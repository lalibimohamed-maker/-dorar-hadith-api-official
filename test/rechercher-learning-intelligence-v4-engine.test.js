import test from 'node:test';
import assert from 'node:assert/strict';
import {createV4LearningIntelligenceEngine,addGraphNode,diagnoseKnowledgeGap,buildLearningPaths,recoverBlockedLearning,explainPersonalizedRecommendation,addEvidenceTrail,recordContradiction,calibrateConfidence,createTeachBack,reviewTeachBack,createSocraticGuidance,startResearchApprenticeship,setCognitiveLoad,runTransferLaboratory,recordAblationEvaluation,registerPrivateLearnerState,queueOfflineLearningEvent,submitReview,rememberTranslationAlignment,mapTerminology,setAccessibilityPresentation,getV4Capabilities} from '../src/rechercher-learning-intelligence-v4-engine.js';

test('V4 implements the agreed learning intelligence surface and safety contract',()=>{
 const e=createV4LearningIntelligenceEngine();
 for(const layer of getV4Capabilities().graphLayers) assert.equal(addGraphNode(e,layer,layer+'-1').layer,layer);
 assert.equal(diagnoseKnowledgeGap(e,{learnerId:'l1',conceptId:'c1',mastery:.2,failedPrerequisiteIds:['p1']}).severity,'BLOCKING');
 assert.equal(buildLearningPaths(e,{startId:'c1',prerequisiteIds:['p1'],similarIds:['c2']}).paths.length,2);
 assert.equal(recoverBlockedLearning(e,{learnerId:'l1',conceptId:'c1',blockers:['p1'],alternatives:['c0']}).status,'RECOVERY_REQUIRED');
 assert.equal(explainPersonalizedRecommendation(e,{learnerId:'l1',itemId:'r1',reasons:['gap'],sourceIds:['s1'],confidence:.8}).explainable,true);
 assert.equal(addEvidenceTrail(e,{claimId:'q1',sourceId:'s1',sourceHash:'sha256:x',locator:'p.1'}).immutableSourceLink,true);
 assert.equal(recordContradiction(e,{claimId:'q1',description:'scholarly disagreement'}).preserved,true);
 assert.equal(calibrateConfidence(e,{learnerId:'l1',predictionId:'x',predicted:.9,outcome:false}).calibratedScore,.1);
 const tb=createTeachBack(e,{learnerId:'l1',conceptId:'c1',response:'answer'}); assert.throws(()=>reviewTeachBack(e,{teachBackId:tb.teachBackId,reviewerRole:'SYSTEM',verdict:'APPROVED'})); assert.equal(reviewTeachBack(e,{teachBackId:tb.teachBackId,reviewerRole:'SCHOLAR',verdict:'APPROVED'}).reviewStatus,'HUMAN_VERIFIED');
 assert.equal(createSocraticGuidance(e,{learnerId:'l1',conceptId:'c1',question:'why?'}).mode,'QUESTION_FIRST');
 assert.equal(startResearchApprenticeship(e,{learnerId:'l1',researchQuestion:'q'}).currentStage,'DISCOVER');
 assert.equal(setCognitiveLoad(e,{learnerId:'l1',itemId:'i',complexity:.9}).recommendedChunking,'SMALL');
 assert.equal(runTransferLaboratory(e,{learnerId:'l1',sourceConceptId:'a',targetConceptId:'b',preScore:.4,postScore:.8}).gain,.4);
 assert.equal(recordAblationEvaluation(e,{experimentId:'x',baseline:.5,treatment:.7,metric:'recall'}).delta,.2);
 assert.equal(registerPrivateLearnerState(e,{learnerId:'l1'}).rawAnswerStorage,false);
 assert.equal(queueOfflineLearningEvent(e,{learnerId:'l1',type:'ATTEMPT'}).rightsPreserved,true);
 assert.throws(()=>submitReview(e,{itemId:'i',reviewerRole:'SYSTEM',verdict:'APPROVED'}));
 assert.equal(submitReview(e,{itemId:'i',reviewerRole:'TEACHER',verdict:'APPROVED'}).humanReviewed,true);
 assert.equal(rememberTranslationAlignment(e,{sourceText:'كتاب',targetText:'book'}).sourceText,'كتاب');
 assert.equal(mapTerminology(e,{term:'فقه',canonicalTerm:'fiqh'}).canonicalTerm,'fiqh');
 assert.equal(setAccessibilityPresentation(e,{learnerId:'l1',mode:'SCREEN_READER'}).mode,'SCREEN_READER');
 const s=getV4Capabilities().safety; assert.equal(s.acquisitionControl,false); assert.equal(s.rightsBypass,false); assert.equal(s.sourceMutation,false); assert.equal(s.quranCanonicalMutation,false); assert.equal(s.scholarlyDisagreementErasure,false); assert.equal(s.unauditedAiAuthority,false);
});
