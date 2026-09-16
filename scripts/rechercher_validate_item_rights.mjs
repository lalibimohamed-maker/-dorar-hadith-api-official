import fs from 'node:fs/promises';
import path from 'node:path';

const dir = process.argv[2] || 'artifacts/rechercher/global-multilingual-research';
const files = (await fs.readdir(dir)).filter((name) => name.endsWith('.jsonl')).sort();

for (const file of files) {
  const filePath = path.join(dir, file);
  const rows = (await fs.readFile(filePath, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
  for (const row of rows) {
    const rightsStage = row.stages.find((stage) => stage.stage === 'rights');
    const itemIdentity = row.item_id || row.resource_id || rightsStage?.evidence?.item_id || null;
    if (!itemIdentity) {
      rightsStage.rights_status = 'review-required';
      rightsStage.item_level_rights_verified = false;
      rightsStage.rights_decision = 'fail-closed';
      row.redistribution_permission = 'not-granted';
      row.final_verification = row.final_verification === 'verified-evidence-chain' ? 'partially-verified' : row.final_verification;
    } else {
      rightsStage.item_level_rights_verified = rightsStage.rights_status === 'known-terms';
      rightsStage.rights_decision = rightsStage.item_level_rights_verified ? 'eligible-for-rights-review-result' : 'fail-closed';
      row.redistribution_permission = rightsStage.item_level_rights_verified ? 'verified-per-item' : 'not-granted';
    }
  }
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
}

console.log(JSON.stringify({schema: 'rechercher/item-rights-validation/v1', files: files.length, policy: 'discovery-does-not-equal-redistribution; item-level-rights-required'}));
