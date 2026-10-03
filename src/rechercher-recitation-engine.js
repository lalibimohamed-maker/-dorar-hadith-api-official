export const RECITATION_STATES = Object.freeze(['RECORDED','ALIGNED','CANDIDATE_ERROR','HUMAN_VERIFIED','REVIEWED']);

export function createRecitationEngine(){return {verses:new Map(),recordings:new Map(),alignments:new Map(),findings:new Map()};}
function required(v,n){if(!v)throw new TypeError(`${n} is required`);}
export function registerVerse(engine,{verseId,surah,ayah,arabic,sourceId,sourceHash}={}){
  required(verseId,'verseId');required(arabic,'arabic');required(sourceId,'sourceId');required(sourceHash,'sourceHash');
  engine.verses.set(verseId,{verseId,surah,ayah,arabic,sourceId,sourceHash});return verseId;
}
export function registerRecording(engine,{recordingId,verseId,language='ar',audioHash,sourceId}={}){
  required(recordingId,'recordingId');required(verseId,'verseId');required(audioHash,'audioHash');
  if(!engine.verses.has(verseId))throw new TypeError(`Unknown verse: ${verseId}`);
  engine.recordings.set(recordingId,{recordingId,verseId,language,audioHash,sourceId,state:'RECORDED'});return recordingId;
}
export function alignRecording(engine,{alignmentId,recordingId,startMs,endMs,textRange}={}){
  required(alignmentId,'alignmentId');required(recordingId,'recordingId');
  if(!engine.recordings.has(recordingId))throw new TypeError(`Unknown recording: ${recordingId}`);
  engine.alignments.set(alignmentId,{alignmentId,recordingId,startMs,endMs,textRange,state:'ALIGNED'});return alignmentId;
}
export function addCandidateError(engine,{findingId,recordingId,alignmentId,type,description}={}){
  required(findingId,'findingId');required(recordingId,'recordingId');required(description,'description');
  engine.findings.set(findingId,{findingId,recordingId,alignmentId,type,description,state:'CANDIDATE_ERROR'});return findingId;
}
export function reviewFinding(engine,{findingId,reviewerRole,verdict,reviewSourceIds=[]}={}){
  required(findingId,'findingId');
  if(!engine.findings.has(findingId))throw new TypeError(`Unknown finding: ${findingId}`);
  if(!['TEACHER','SCHOLAR'].includes(reviewerRole))throw new TypeError('Recitation verification requires teacher or scholar review');
  const finding=engine.findings.get(findingId);finding.reviewerRole=reviewerRole;finding.verdict=verdict;finding.reviewSourceIds=[...reviewSourceIds];finding.state=verdict==='VERIFIED'?'HUMAN_VERIFIED':'REVIEWED';return finding;
}
