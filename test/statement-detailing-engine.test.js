const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'config', 'research', 'statement-detailing-engine-2026.json');
const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));

if (cfg.rules.never_invent_details !== true) throw new Error('Detailing engine must never invent details');
if (cfg.rules.preserve_original_claim !== true) throw new Error('Original claim must be preserved');
if (cfg.rules.require_provenance_for_added_detail !== true) throw new Error('Added detail requires provenance');
if (cfg.rules.distinguish_source_text_from_analysis !== true) throw new Error('Source text and analysis must remain distinct');
if (cfg.cost_policy.paid_dependency_required !== false) throw new Error('Paid dependency must not be required');

console.log('statement-detailing-engine: PASS');
