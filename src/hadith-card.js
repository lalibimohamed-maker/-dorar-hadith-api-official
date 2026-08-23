import { attachChainEvidence } from './hadith-chain-evidence.js';
import { groupScholarAssessments } from './hadith-scholar-assessments.js';

export function buildHadithCard(hadith = {}, relations = [], assessments = []) {
  const withEvidence = attachChainEvidence(hadith, relations);
  return {
    ...withEvidence,
    source: { sourceId: hadith.sourceId || null, reference: hadith.reference || null },
    scholarAssessments: groupScholarAssessments(hadith.hadithId, assessments),
    aiRequired: false
  };
}
