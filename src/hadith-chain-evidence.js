import { validateChain } from './rijal-chain.js';

export function validateHadithChainEvidence(hadith = {}, relations = []) {
  const chain = Array.isArray(hadith.chain) ? hadith.chain : [];
  const chainResult = validateChain(chain, relations);
  const errors = [];
  if (!hadith.hadithId) errors.push('missing:hadithId');
  if (!hadith.sourceId) errors.push('missing:sourceId');
  if (!hadith.reference) errors.push('missing:reference');
  if (!chain.length) errors.push('missing:chain');
  return {
    valid: errors.length === 0 && chainResult.valid,
    metadataValid: errors.length === 0,
    chainEvidenceValid: chainResult.valid,
    errors,
    chainErrors: chainResult.errors,
    hadithId: hadith.hadithId || null,
    sourceId: hadith.sourceId || null,
    reference: hadith.reference || null
  };
}

export function attachChainEvidence(hadith = {}, relations = []) {
  return { ...hadith, chainEvidence: validateHadithChainEvidence(hadith, relations) };
}

export function compareHadithScholarAssessments(hadithId, assessments = []) {
  const relevant = assessments.filter((item) => item.hadithId === hadithId);
  return {
    hadithId,
    count: relevant.length,
    assessments: relevant.map((item) => ({
      scholarId: item.scholarId || null,
      scholarName: item.scholarName || null,
      sourceId: item.sourceId || null,
      reference: item.reference || null,
      text: item.text || null,
      classification: item.classification || 'unclassified'
    })),
    synthesizedVerdict: null,
    note: 'Assessments remain separately attributed; no automatic hadith grade is synthesized.'
  };
}
