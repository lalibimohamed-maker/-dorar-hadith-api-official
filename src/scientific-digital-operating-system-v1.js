/**
 * Din Allah Encyclopedia — Scientific & Digital Operating System v1.
 * Contract-first state machine; no Corpus mutation or silent source replacement.
 */

export const OPERATING_STAGES = Object.freeze([
  'DISCOVERED','IDENTIFIED','EDITION_RESOLVED','SOURCE_VERIFIED','RIGHTS_VERIFIED',
  'ACQUIRED','SHA256_LOCKED','PDF_VALIDATED','PAGE_INTEGRITY_PASSED','OCR',
  'OCR_CONFIDENCE_REVIEW','TEXT_COLLATION','TEXT_VERIFIED','QUALITY_SCORED','PUBLICATION_APPROVED'
]);

export const QUALITY_WEIGHTS = Object.freeze({
  Identity: 20, Source: 20, Scan: 15, Completeness: 15, OCR: 15, Metadata: 10, Rights: 5
});

export const REQUIRED_RIGHTS_FIELDS = Object.freeze([
  'rights_source','rights_evidence','rights_checked_at','rights_checked_by',
  'license','territory','expiry','redistribution_allowed','derivative_allowed'
]);

export const REQUIRED_AUDIT_FIELDS = Object.freeze([
  'who','what','when','source','old_value','new_value','reason','commit','hash'
]);

const PUBLICATION_MINIMUM = 80;
const RIGHTS_ALLOWED = new Set(['verified-redistributable','source-permitted','public-domain']);

function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function sha256(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value); }
function hasAll(record, fields) {
  return fields.every((field) => record?.[field] !== undefined && record?.[field] !== null &&
    (typeof record[field] !== 'string' || record[field].trim().length > 0));
}

export function buildIdentity({ workId, editionId, digitalCopyId, sourceId, rightsEvidenceId } = {}) {
  if (![workId,editionId,digitalCopyId,sourceId,rightsEvidenceId].every(nonEmpty)) {
    throw new TypeError('WORK_ID, EDITION_ID, DIGITAL_COPY_ID, SOURCE_ID and RIGHTS_EVIDENCE_ID are required');
  }
  return Object.freeze({ WORK_ID:workId, EDITION_ID:editionId, DIGITAL_COPY_ID:digitalCopyId,
    SOURCE_ID:sourceId, RIGHTS_EVIDENCE_ID:rightsEvidenceId });
}

export function evaluateIdentity(record = {}) {
  const failures = [];
  if (!nonEmpty(record.WORK_ID)) failures.push('WORK_ID_missing');
  if (!nonEmpty(record.EDITION_ID)) failures.push('EDITION_ID_missing');
  if (!nonEmpty(record.DIGITAL_COPY_ID)) failures.push('DIGITAL_COPY_ID_missing');
  if (!nonEmpty(record.SOURCE_ID)) failures.push('SOURCE_ID_missing');
  if (!nonEmpty(record.RIGHTS_EVIDENCE_ID)) failures.push('RIGHTS_EVIDENCE_ID_missing');
  return Object.freeze({ passed: failures.length === 0, failures });
}

export function evaluateRights(rights = {}) {
  const failures = [];
  if (!hasAll(rights, REQUIRED_RIGHTS_FIELDS)) failures.push('rights_evidence_incomplete');
  if (!RIGHTS_ALLOWED.has(rights.status)) failures.push('rights_status_not_publishable');
  if (rights.redistribution_allowed !== true) failures.push('redistribution_not_allowed');
  return Object.freeze({ passed: failures.length === 0, failures });
}

export function lockSha256(digitalCopy = {}) {
  if (!sha256(digitalCopy.sha256)) throw new TypeError('DIGITAL_COPY requires a 64-character SHA-256');
  if (!nonEmpty(digitalCopy.retrieved_at)) throw new TypeError('retrieved_at is required');
  return Object.freeze({ ...digitalCopy, SHA256_LOCKED:true, sha256LockedAt:digitalCopy.retrieved_at });
}

export function evaluatePageIntegrity(pageIntegrity = {}) {
  const failures = [];
  if (pageIntegrity.status !== 'passed') failures.push('page_integrity_not_passed');
  const required = ['page_count','missing_pages','duplicate_pages','blank_pages',
    'orientation_anomalies','corrupt_pages','volume_completeness'];
  for (const field of required) {
    if (pageIntegrity[field] === undefined || pageIntegrity[field] === null) failures.push('page_' + field + '_missing');
  }
  if (pageIntegrity.missing_pages !== 0) failures.push('missing_pages');
  if (pageIntegrity.duplicate_pages !== 0) failures.push('duplicate_pages');
  if (pageIntegrity.blank_pages !== 0) failures.push('blank_pages');
  if (pageIntegrity.orientation_anomalies !== 0) failures.push('orientation_anomalies');
  if (pageIntegrity.corrupt_pages !== 0) failures.push('corrupt_pages');
  if (pageIntegrity.volume_completeness !== 'passed') failures.push('volume_completeness');
  return Object.freeze({ passed: failures.length === 0, failures });
}

export function createOcrPageRecord({ page, imageSha256, text, engine, engineVersion, language, confidence } = {}) {
  if (!Number.isInteger(page) || page < 1) throw new TypeError('page must be a positive integer');
  if (!sha256(imageSha256)) throw new TypeError('page image SHA-256 is required');
  if (!nonEmpty(engine) || !nonEmpty(engineVersion) || !nonEmpty(language)) {
    throw new TypeError('OCR engine, version and language are required');
  }
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    throw new TypeError('OCR confidence must be between 0 and 1');
  }
  return Object.freeze({
    page, imageSha256, sidecarText:text ?? '', engine, engineVersion, language, confidence,
    requiresHumanReview:confidence < 0.90, authoritative:false
  });
}

export function evaluateOcrConfidence(pages = [], { reviewThreshold = 0.90, publicationThreshold = 0.97 } = {}) {
  const failures = [];
  if (!Array.isArray(pages) || pages.length === 0) failures.push('ocr_pages_missing');
  const lowConfidencePages = pages.filter((p) => p.confidence < reviewThreshold).map((p) => p.page);
  const belowPublicationThreshold = pages.filter((p) => p.confidence < publicationThreshold).map((p) => p.page);
  if (lowConfidencePages.length) failures.push('low_confidence_review_required');
  if (belowPublicationThreshold.length) failures.push('ocr_publication_threshold_not_met');
  return Object.freeze({
    passed:failures.length === 0, failures, lowConfidencePages, belowPublicationThreshold, authoritative:false
  });
}

export function evaluateCollation({ ocrVsPageImage, editionDifferences = [], unresolvedDifferences = [] } = {}) {
  const failures = [];
  if (ocrVsPageImage !== 'passed') failures.push('ocr_vs_page_image_not_verified');
  if (unresolvedDifferences.length) failures.push('unresolved_collation_conflicts');
  return Object.freeze({ passed:failures.length === 0, failures,
    editionDifferences:[...editionDifferences], unresolvedDifferences:[...unresolvedDifferences] });
}

export function scoreQuality(components = {}) {
  const missing = Object.keys(QUALITY_WEIGHTS).filter((key) =>
    typeof components[key] !== 'number' || components[key] < 0 || components[key] > 100);
  if (missing.length) throw new TypeError('missing or invalid quality components: ' + missing.join(','));
  const score = Object.entries(QUALITY_WEIGHTS).reduce((total,[key,weight]) =>
    total + components[key] * weight / 100, 0);
  return Object.freeze({ score:Math.round(score * 100) / 100, passed:score >= PUBLICATION_MINIMUM,
    weights:{...QUALITY_WEIGHTS} });
}

export function createAuditEvent({ who, what, when, source, old_value, new_value, reason, commit, hash } = {}) {
  const event = {who,what,when,source,old_value,new_value,reason,commit,hash};
  if (!hasAll(event, REQUIRED_AUDIT_FIELDS)) throw new TypeError('complete audit event required');
  return Object.freeze(event);
}

export function evaluateChangeDelta(previous = {}, current = {}) {
  const fields = ['source','edition','rights','sha256','page_count','ocr_quality'];
  const changedFields = fields.filter((field) => JSON.stringify(previous[field]) !== JSON.stringify(current[field]));
  return Object.freeze({
    changed:changedFields.length > 0, changedFields,
    reacquireRecommended:changedFields.length > 0, automaticReacquisition:false
  });
}

export function engineHealthSnapshot(input = {}) {
  return Object.freeze({
    latencyMs:input.latencyMs, successRate:input.successRate, candidateRate:input.candidateRate,
    acquisitionRate:input.acquisitionRate, validationFailures:input.validationFailures,
    rightsHolds:input.rightsHolds, lowConfidenceOcrPages:input.lowConfidenceOcrPages,
    collationConflicts:input.collationConflicts, publicationRejections:input.publicationRejections,
    backupLastSuccess:input.backupLastSuccess, recoveryLastTest:input.recoveryLastTest,
    recoveryTested:nonEmpty(input.recoveryLastTest)
  });
}

export function evaluateBackupReadiness({
  encryptedCopies = 0, separatedCopy = false, restoreTested = false, rpoHours = 24, rtoHours = 24
} = {}) {
  const failures = [];
  if (encryptedCopies < 2) failures.push('two_encrypted_copies_required');
  if (separatedCopy !== true) failures.push('separated_or_offsite_copy_required');
  if (restoreTested !== true) failures.push('restore_test_required');
  if (rpoHours > 24) failures.push('rpo_target_exceeds_24h');
  if (rtoHours > 24) failures.push('rto_target_exceeds_24h');
  return Object.freeze({ passed:failures.length === 0, failures, rpoHours, rtoHours });
}

export function evaluateOperatingState(record = {}) {
  const s = record.stages || {};
  const state = {};
  const identity = evaluateIdentity(record);
  const rights = evaluateRights(record.rights || {});
  for (let i=0;i<OPERATING_STAGES.length;i += 1) {
    const stage = OPERATING_STAGES[i];
    if (stage === 'DISCOVERED') state[stage] = {passed:true,failures:[]};
    else if (stage === 'IDENTIFIED') state[stage] = identity;
    else if (stage === 'EDITION_RESOLVED') state[stage] = {passed:nonEmpty(record.editionResolvedAt),failures:nonEmpty(record.editionResolvedAt)?[]:['edition_resolution_missing']};
    else if (stage === 'SOURCE_VERIFIED') state[stage] = {passed:nonEmpty(record.SOURCE_ID)&&record.sourceVerified===true,failures:(nonEmpty(record.SOURCE_ID)&&record.sourceVerified===true)?[]:['source_not_verified']};
    else if (stage === 'RIGHTS_VERIFIED') state[stage] = rights;
    else if (stage === 'ACQUIRED') state[stage] = {passed:record.acquired===true,failures:record.acquired===true?[]:['acquisition_missing']};
    else if (stage === 'SHA256_LOCKED') state[stage] = {passed:record.digitalCopy?.SHA256_LOCKED===true,failures:record.digitalCopy?.SHA256_LOCKED===true?[]:['sha256_not_locked']};
    else if (stage === 'PDF_VALIDATED') state[stage] = {passed:record.pdfValidation?.status==='passed',failures:record.pdfValidation?.status==='passed'?[]:['pdf_validation_missing']};
    else if (stage === 'PAGE_INTEGRITY_PASSED') state[stage] = evaluatePageIntegrity(record.pageIntegrity || {});
    else if (stage === 'OCR') state[stage] = {passed:Array.isArray(record.ocrPages)&&record.ocrPages.length>0,failures:(Array.isArray(record.ocrPages)&&record.ocrPages.length>0)?[]:['ocr_missing']};
    else if (stage === 'OCR_CONFIDENCE_REVIEW') state[stage] = evaluateOcrConfidence(record.ocrPages || []);
    else if (stage === 'TEXT_COLLATION') state[stage] = evaluateCollation(record.collation || {});
    else if (stage === 'TEXT_VERIFIED') state[stage] = {passed:record.textVerified===true,failures:record.textVerified===true?[]:['text_not_verified']};
    else if (stage === 'QUALITY_SCORED') state[stage] = record.qualityScore?.passed===true ? record.qualityScore : {passed:false,failures:['quality_threshold_not_met']};
    else state[stage] = {passed:false,failures:['awaiting_publication_gate']};
  }
  const failures = [];
  for (const stage of OPERATING_STAGES) {
    if (state[stage].passed !== true && stage !== 'DISCOVERED') {
      failures.push(...state[stage].failures.map((reason) => stage + ':' + reason));
    }
  }
  const firstHold = OPERATING_STAGES.find((stage) => state[stage].passed !== true) || null;
  return Object.freeze({state:firstHold?'HOLD':'PUBLICATION_APPROVED',firstHold,
    failures:[...new Set(failures)],stages:state});
}

export function evaluatePublicationGate(record = {}) {
  const operating = evaluateOperatingState(record);
  const rights = evaluateRights(record.rights || {});
  const audit = Array.isArray(record.auditEvents) && record.auditEvents.length > 0;
  const missing = [];
  if (!audit) missing.push('audit_record_missing');
  const approved = operating.state === 'PUBLICATION_APPROVED' && rights.passed && audit;
  return Object.freeze({
    state:approved?'PUBLICATION_APPROVED':'HOLD',
    failures:[...new Set([...operating.failures,...missing])],
    score:record.qualityScore?.score ?? null, publicationMinimum:PUBLICATION_MINIMUM
  });
}

export function operatingSystemPolicy() {
  return Object.freeze({
    discoveryIdentityEditionDigitalCopyRightsPublicationAreDistinct:true,
    missingStageBecomesHold:true, automaticStageSkipping:false,
    ocrIsDerivedNotAuthoritative:true, discoveryOrMetadataCannotGrantRedistributionRights:true,
    qualityMinimum:PUBLICATION_MINIMUM, noCorpusMutation:true, noSilentCorpusReplacement:true,
    backupRecoveryTestRequired:true
  });
}
