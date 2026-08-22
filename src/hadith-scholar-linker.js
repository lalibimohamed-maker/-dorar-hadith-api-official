import { getHadithEvidenceRegistry } from './hadith-evidence-registry.js';

export function buildHadithScholarLinks() {
  const registry = getHadithEvidenceRegistry();
  return registry.records.map((record) => ({
    evidenceId: record.id,
    domain: record.domain,
    subtopic: record.subtopic,
    verificationStatus: record.verificationStatus,
    sourceCollection: record.sourceCollection,
    reference: record.reference,
    scholarWorks: record.scholarWorks || [],
    rule: 'ذكر العالم للرواية لا يساوي تصحيحها؛ التصحيح مستقل عن نسبة النقل.'
  }));
}

export function getResearchTree(domain) {
  return buildHadithScholarLinks().filter((item) => !domain || item.domain === domain);
}
