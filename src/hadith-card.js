import { attachChainEvidence, compareHadithScholarAssessments } from './hadith-chain-evidence.js';

export function buildHadithCard(hadith = {}, relations = [], assessments = []) {
  const withEvidence = attachChainEvidence(hadith, relations);
  return {
    ...withEvidence,
    source: { sourceId: hadith.sourceId || null, reference: hadith.reference || null },
    scholarAssessments: compareHadithScholarAssessments(hadith.hadithId, assessments),
    aiRequired: false
  };
}
