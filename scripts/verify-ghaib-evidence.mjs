import { getHadithEvidenceRegistry } from '../src/hadith-evidence-registry.js';
import { buildHadithScholarLinks } from '../src/hadith-scholar-linker.js';

const registry = getHadithEvidenceRegistry();
if (registry.status !== 'source-linked-structure') throw new Error('Unexpected registry status');
for (const row of registry.records) {
  if (!row.sourceCollection || !row.reference || !row.verificationStatus) throw new Error(`Incomplete evidence record: ${row.id}`);
}
const links = buildHadithScholarLinks();
if (links.length !== registry.records.length) throw new Error('Evidence/link count mismatch');
console.log(JSON.stringify({status:'ok', evidenceRecords:registry.records.length, linkedRecords:links.length}, null, 2));
