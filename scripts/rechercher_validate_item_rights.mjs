import fs from 'node:fs/promises';
import path from 'node:path';

const dir = process.argv[2] || 'artifacts/rechercher/global-multilingual-research';
const files = (await fs.readdir(dir)).filter((name) => name.endsWith('.jsonl')).sort();

const RIGHTS_SIGNALS = /\bcc0\b|public[_ -]?domain|creativecommons\.org\/licenses\/(by|by-sa)(?:\/|$)|\bpermission(?:s)?\b|\blicen[cs]e\b/i;

for (const file of files) {
  const filePath = path.join(dir, file);
  const rows = (await fs.readFile(filePath, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
  for (const row of rows) {
    const rightsStage = row.stages.find((stage) => stage.stage === 'rights');
    const corpusStage = row.stages.find((stage) => stage.stage === 'digital_corpus');
    const itemIdentity = row.item_id || corpusStage?.item_id || rightsStage?.evidence?.item_id || null;
    const fields = [
      ...(row.rights_evidence?.fields || []),
      ...(rightsStage?.evidence?.fields || [])
    ];
    const rightsText = fields.map((field) => `${field.field || ''} ${field.value || ''}`).join(' ');
    const explicitRightsEvidence = Boolean(itemIdentity && rightsText && RIGHTS_SIGNALS.test(rightsText));

    if (!itemIdentity) {
      rightsStage.rights_status = 'review-required';
      rightsStage.item_level_rights_verified = false;
      rightsStage.rights_decision = 'fail-closed';
      rightsStage.redistribution_permission = 'not-granted';
      row.redistribution_permission = 'not-granted';
      row.final_verification = row.final_verification === 'verified-evidence-chain' ? 'partially-verified' : row.final_verification;
    } else if (!explicitRightsEvidence) {
      rightsStage.rights_status = 'review-required';
      rightsStage.item_level_rights_verified = false;
      rightsStage.rights_decision = 'fail-closed';
      rightsStage.redistribution_permission = 'not-granted';
      row.redistribution_permission = 'not-granted';
      row.final_verification = row.final_verification === 'verified-evidence-chain' ? 'partially-verified' : row.final_verification;
    } else {
      rightsStage.rights_status = 'known-terms';
      rightsStage.item_level_rights_verified = true;
      rightsStage.rights_decision = 'eligible-for-rights-review-result';
      rightsStage.redistribution_permission = 'verified-per-item';
      row.redistribution_permission = 'verified-per-item';
    }
  }
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
}

console.log(JSON.stringify({schema:'rechercher/item-rights-validation/v2',files:files.length,policy:'discover-and-preserve; item-level-rights-evidence-required-for-redistribution'}));
