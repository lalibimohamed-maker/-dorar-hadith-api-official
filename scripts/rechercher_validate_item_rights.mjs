import fs from 'node:fs/promises';
import path from 'node:path';
import {extractRightsMetadata, decideItemRedistribution} from './rechercher_extract_item_rights.mjs';

const dir = process.argv[2] || 'artifacts/rechercher/global-multilingual-research';
const files = (await fs.readdir(dir)).filter((name) => name.endsWith('.jsonl')).sort();

function browserDelivery(decision, sourceUrl) {
  if (decision.redistribution_permission === 'verified-per-item') {
    return {mode: 'public-download', allowed: true, source_url: sourceUrl || null, license_required: true, show_conditions: true};
  }
  return {mode: 'source-or-review', allowed: false, source_url: sourceUrl || null, license_required: false, show_conditions: true};
}

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
    const sourceUrl = prior.final_url || prior.url || row.source_url || null;
    const evidence = extractRightsMetadata({
      metadata: prior.metadata || prior.json || null,
      text: prior.text_sample || prior.text || prior.raw_text || '',
      sourceUrl,
      itemId,
      resourceId,
      checkedAt: prior.checked_at || row.checked_at || new Date().toISOString()
    });
    const decision = decideItemRedistribution(evidence);
    const delivery = browserDelivery(decision, sourceUrl);
    row.rights_evidence = evidence;
    rightsStage.evidence = {...rightsStage.evidence, ...evidence};
    Object.assign(rightsStage, decision);
    row.redistribution_permission = decision.redistribution_permission;
    row.catalog_access = 'preserved';
    row.browser_delivery = delivery;
    row.source_access = decision.redistribution_permission === 'verified-per-item' ? 'redistributable-source' : 'original-source-or-review';
    row.alternate_source_search = {
      required_when: decision.redistribution_permission !== 'verified-per-item',
      status: decision.redistribution_permission === 'verified-per-item' ? 'not-required' : 'continue-search',
      preserve_same_work_identity: true
    };
    if (decision.redistribution_permission !== 'verified-per-item' && row.final_verification === 'verified-evidence-chain') {
      row.final_verification = 'partially-verified';
    }
  }
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
}

console.log(JSON.stringify({
  schema: 'rechercher/item-rights-validation/v4',
  files: files.length,
  policy: 'discover-collect-analyze-preserve; item-level-rights-evidence-gates-public-redistribution-only',
  unknown_rights: 'catalog-preserved; public-download-denied; source-or-review-allowed; continue-alternate-source-search',
  fail_closed: true
}));
