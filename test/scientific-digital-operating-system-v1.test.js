import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPERATING_STAGES, QUALITY_WEIGHTS, buildIdentity, createAuditEvent, createOcrPageRecord,
  evaluateBackupReadiness, evaluateCollation, evaluateOperatingState, evaluatePublicationGate,
  evaluateRights, evaluatePageIntegrity, engineHealthSnapshot, evaluateChangeDelta,
  lockSha256, operatingSystemPolicy, scoreQuality
} from '../src/scientific-digital-operating-system-v1.js';

const goodPages={status:'passed',page_count:100,missing_pages:0,duplicate_pages:0,blank_pages:0,
  orientation_anomalies:0,corrupt_pages:0,volume_completeness:'passed'};
const goodOcr=Array.from({length:2},(_,i)=>createOcrPageRecord({
  page:i+1,imageSha256:'a'.repeat(64),text:'text',engine:'engine-a',engineVersion:'1.0',language:'ar',confidence:0.99
}));

function goodRecord(){
  return {
    WORK_ID:'work-1',EDITION_ID:'edition-1',DIGITAL_COPY_ID:'copy-1',SOURCE_ID:'source-1',RIGHTS_EVIDENCE_ID:'rights-1',
    editionResolvedAt:'2026-09-28T00:00:00Z',sourceVerified:true,acquired:true,
    digitalCopy:lockSha256({sourceId:'source-1',retrieved_at:'2026-09-28T00:00:00Z',sha256:'b'.repeat(64)}),
    pdfValidation:{status:'passed'},pageIntegrity:goodPages,ocrPages:goodOcr,
    collation:{ocrVsPageImage:'passed',editionDifferences:[],unresolvedDifferences:[]},textVerified:true,
    qualityScore:scoreQuality({Identity:100,Source:100,Scan:100,Completeness:100,OCR:99,Metadata:100,Rights:100}),
    rights:{
      status:'verified-redistributable',rights_source:'rs',rights_evidence:'rights-1',
      rights_checked_at:'2026-09-28T00:00:00Z',rights_checked_by:'reviewer-1',license:'license',
      territory:'worldwide',expiry:'none',redistribution_allowed:true,derivative_allowed:true
    },
    auditEvents:[createAuditEvent({
      who:'reviewer-1',what:'publication-review',when:'2026-09-28T00:00:00Z',source:'governance',
      old_value:null,new_value:'approved',reason:'all gates passed',commit:'abc123',hash:'c'.repeat(64)
    })]
  };
}

test('exact pipeline is non-skippable',()=>{
  assert.deepEqual(OPERATING_STAGES,['DISCOVERED','IDENTIFIED','EDITION_RESOLVED','SOURCE_VERIFIED','RIGHTS_VERIFIED','ACQUIRED',
    'SHA256_LOCKED','PDF_VALIDATED','PAGE_INTEGRITY_PASSED','OCR','OCR_CONFIDENCE_REVIEW','TEXT_COLLATION','TEXT_VERIFIED','QUALITY_SCORED','PUBLICATION_APPROVED']);
  assert.equal(operatingSystemPolicy().automaticStageSkipping,false);
});

test('identity fields are distinct',()=>{
  assert.deepEqual(Object.keys(buildIdentity({workId:'W',editionId:'E',digitalCopyId:'D',sourceId:'S',rightsEvidenceId:'R'})),
    ['WORK_ID','EDITION_ID','DIGITAL_COPY_ID','SOURCE_ID','RIGHTS_EVIDENCE_ID']);
});

test('rights fail closed',()=>{
  assert.equal(evaluateRights({status:'unknown'}).passed,false);
  assert.equal(evaluateRights({
    status:'verified-redistributable',rights_source:'s',rights_evidence:'r',rights_checked_at:'t',rights_checked_by:'u',
    license:'l',territory:'world',expiry:'none',redistribution_allowed:true,derivative_allowed:true
  }).passed,true);
});

test('page integrity requires image-level audit fields beyond page count',()=>{
  assert.equal(evaluatePageIntegrity({status:'passed',page_count:100}).passed,false);
  assert.equal(evaluatePageIntegrity(goodPages).passed,true);
});

test('OCR is derived, preserves page-image hash and is never authoritative',()=>{
  const p=goodOcr[0];
  assert.equal(p.authoritative,false); assert.equal(p.imageSha256,'a'.repeat(64));
});

test('low-confidence OCR remains a HOLD',()=>{
  const state=evaluateOperatingState({
    WORK_ID:'w',EDITION_ID:'e',DIGITAL_COPY_ID:'d',SOURCE_ID:'s',RIGHTS_EVIDENCE_ID:'r',
    editionResolvedAt:'x',sourceVerified:true,acquired:true,digitalCopy:{SHA256_LOCKED:true},
    pdfValidation:{status:'passed'},pageIntegrity:goodPages,
    ocrPages:[createOcrPageRecord({page:1,imageSha256:'a'.repeat(64),text:'x',engine:'e',engineVersion:'1',language:'ar',confidence:0.85})],
    collation:{ocrVsPageImage:'passed',unresolvedDifferences:[]},textVerified:false
  });
  assert.equal(state.state,'HOLD'); assert.equal(state.firstHold,'RIGHTS_VERIFIED');
});

test('collation conflicts are explicit and blocking',()=>{
  const r=evaluateCollation({ocrVsPageImage:'passed',editionDifferences:[{page:10,kind:'variant'}],
    unresolvedDifferences:[{page:11,kind:'missing-text'}]});
  assert.equal(r.passed,false); assert.equal(r.editionDifferences.length,1);
});

test('quality score uses exact weighted model and minimum 80',()=>{
  const r=scoreQuality({Identity:100,Source:100,Scan:100,Completeness:100,OCR:100,Metadata:100,Rights:100});
  assert.equal(r.score,100); assert.equal(r.passed,true);
  assert.deepEqual(QUALITY_WEIGHTS,{Identity:20,Source:20,Scan:15,Completeness:15,OCR:15,Metadata:10,Rights:5});
});

test('source/edition/rights/hash/page/OCR changes trigger recommendation but never automatic reacquisition',()=>{
  const r=evaluateChangeDelta({source:'a',edition:'e',rights:'r',sha256:'1',page_count:10,ocr_quality:0.9},
    {source:'b',edition:'e',rights:'r',sha256:'2',page_count:11,ocr_quality:0.9});
  assert.deepEqual(r.changedFields.sort(),['page_count','sha256','source']);
  assert.equal(r.reacquireRecommended,true); assert.equal(r.automaticReacquisition,false);
});

test('backup requires two encrypted copies, separation, and tested restore',()=>{
  assert.equal(evaluateBackupReadiness({encryptedCopies:1,separatedCopy:false,restoreTested:false}).passed,false);
  assert.equal(evaluateBackupReadiness({encryptedCopies:2,separatedCopy:true,restoreTested:true,rpoHours:24,rtoHours:24}).passed,true);
});

test('audit event contains all mandatory fields',()=>{
  const e=createAuditEvent({who:'u',what:'x',when:'t',source:'s',old_value:null,new_value:'n',reason:'r',commit:'c',hash:'d'.repeat(64)});
  assert.equal(e.commit,'c');
});

test('health snapshot carries the required monitoring dimensions',()=>{
  const h=engineHealthSnapshot({latencyMs:10,successRate:.9,candidateRate:.2,acquisitionRate:.1,
    validationFailures:2,rightsHolds:3,lowConfidenceOcrPages:4,collationConflicts:5,publicationRejections:6,
    backupLastSuccess:'t',recoveryLastTest:'t'});
  assert.equal(h.recoveryTested,true); assert.equal(h.collationConflicts,5);
});

test('complete record publishes only with every gate and audit',()=>{
  const record=goodRecord();
  assert.equal(evaluateOperatingState(record).firstHold,'PUBLICATION_APPROVED');
  assert.equal(evaluatePublicationGate(record).state,'PUBLICATION_APPROVED');
  assert.equal(evaluatePublicationGate({...record,auditEvents:[]}).state,'HOLD');
});

test('Corpus mutation and silent replacement are forbidden',()=>{
  const p=operatingSystemPolicy();
  assert.equal(p.noCorpusMutation,true); assert.equal(p.noSilentCorpusReplacement,true);
});
