import fs from 'node:fs/promises';
import path from 'node:path';
import {extractRightsMetadata, decideItemRedistribution} from './rechercher_extract_item_rights.mjs';

const dir = process.argv[2] || 'artifacts/rechercher/global-multilingual-research';
const files = (await fs.readdir(dir)).filter((name) => name.endsWith('.jsonl')).sort();

for (const file of files) {
  const filePath = path.join(dir, file);
  const rows = (await fs.readFile(filePath, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
  for (const row of rows) {
    const rightsStage = row.stages.find((stage) => stage.stage === 'rights');
    if (!rightsStage) throw new Error(`Missing rights stage for ${row.cell_id || 'unknown-cell'}`);
    const corpusStage = row.stages.find((stage) => stage.stage === 'digital_corpus');
    const itemId = row.item_id || corpusStage?.item_id || rightsStage?.evidence?.item_id || null;
    const resourceId = row.resource_id || rightsStage?.evidence?.resource_id || null;
    const prior = row.rights_evidence || rightsStage.evidence || {};
    const evidence = extractRightsMetadata({
      metadata: prior.metadata || prior.json || null,
      text: prior.text_sample || prior.text || prior.raw_text || '',
      sourceUrl: prior.final_url || prior.url || row.source_url || null,
      itemId,
      resourceId,
      checkedAt: prior.checked_at || row.checked_at || new Date().toISOString()
    });
    const decision = decideItemRedistribution(evidence);
    row.rights_evidence = evidence;
    rightsStage.evidence = {...rightsStage.evidence, ...evidence};
    Object.assign(rightsStage, decision);
    row.redistribution_permission = decision.redistribution_permission;
    if (decision.redistribution_permission !== 'verified-per-item' && row.final_verification === 'verified-evidence-chain') {
      row.final_verification = 'partially-verified';
    }
  }
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
}

console.log(JSON.stringify({
  schema: 'rechercher/item-rights-validation/v3',
  files: files.length,
  policy: 'discover-preserve-analyze; public-redistribution-requires-exact-item-level-rights-evidence',
  fail_closed: true
}));
