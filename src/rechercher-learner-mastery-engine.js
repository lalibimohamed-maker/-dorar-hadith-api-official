export const ROLES = Object.freeze(['STUDENT','TEACHER','SCHOLAR']);

export function createMasteryEngine() {
  return { concepts:new Map(), learners:new Map(), attempts:new Map(), reviews:new Map() };
}

function required(value,name){if(!value)throw new TypeError(`${name} is required`);}

export function registerConcept(engine,{conceptId,title,prerequisiteIds=[]}={}){
  required(conceptId,'conceptId'); required(title,'title');
  for(const id of prerequisiteIds)if(!engine.concepts.has(id))throw new TypeError(`Unknown prerequisite: ${id}`);
  engine.concepts.set(conceptId,{conceptId,title,prerequisiteIds:[...prerequisiteIds]});return conceptId;
}

export function registerLearner(engine,{learnerId,role='STUDENT',language='ar'}={}){
  required(learnerId,'learnerId');if(!ROLES.includes(role))throw new TypeError(`Unknown role: ${role}`);
  engine.learners.set(learnerId,{learnerId,role,language,mastery:{}});return learnerId;
}

export function recordAttempt(engine,{attemptId,learnerId,conceptId,correct,evidenceSourceIds=[]}={}){
  required(attemptId,'attemptId');required(learnerId,'learnerId');required(conceptId,'conceptId');
  if(!engine.learners.has(learnerId)||!engine.concepts.has(conceptId))throw new TypeError('Unknown learner or concept');
  const score=correct?1:0;const attempt={attemptId,learnerId,conceptId,correct:Boolean(correct),score,evidenceSourceIds:[...evidenceSourceIds]};
  engine.attempts.set(attemptId,attempt);
  const prior=engine.learners.get(learnerId).mastery[conceptId]??0;
  engine.learners.get(learnerId).mastery[conceptId]=Math.max(0,Math.min(1,prior*0.7+score*0.3));
  return attemptId;
}

export function suggestNextConcepts(engine,learnerId){
  const learner=engine.learners.get(learnerId);if(!learner)throw new Error(`Unknown learner: ${learnerId}`);
  return [...engine.concepts.values()].filter(c=>{
    const mastery=learner.mastery[c.conceptId]??0;
    return mastery<0.8&&c.prerequisiteIds.every(p=>(learner.mastery[p]??0)>=0.6);
  }).sort((a,b)=>(learner.mastery[a.conceptId]??0)-(learner.mastery[b.conceptId]??0)).map(c=>c.conceptId);
}

export function recordTeachBack(engine,{reviewId,learnerId,conceptId,reviewerRole,verdict,sourceIds=[]}={}){
  required(reviewId,'reviewId');required(learnerId,'learnerId');required(conceptId,'conceptId');
  if(!ROLES.includes(reviewerRole)||reviewerRole==='STUDENT')throw new TypeError('Teach-back requires teacher or scholar review');
  engine.reviews.set(reviewId,{reviewId,learnerId,conceptId,reviewerRole,verdict,sourceIds:[...sourceIds]});return reviewId;
}
