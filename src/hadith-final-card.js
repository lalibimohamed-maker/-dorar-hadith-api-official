import { buildHadithCard } from './hadith-card.js';

export function buildFinalHadithCard(hadith = {}, relations = [], assessments = [], metadata = {}) {
  const card = buildHadithCard(hadith, relations, assessments);
  return {
    apiVersion: '2026-08-23',
    type: 'hadith-card',
    hadith: { id: hadith.hadithId || null, text: hadith.text || null, sourceId: hadith.sourceId || null, reference: hadith.reference || null },
    chainEvidence: card.chainEvidence,
    scholarAssessments: card.scholarAssessments,
    provenance: { sourceId: hadith.sourceId || null, reference: hadith.reference || null, verificationState: metadata.verificationState || 'pending_review' },
    aiRequired: false
  };
}
