import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const config = new URL('../config/research/statement-detailing-engine-2026.json', import.meta.url);
const cfg = JSON.parse(fs.readFileSync(config, 'utf8'));

test('detailing engine keeps scholarly safeguards', () => {
  assert.equal(cfg.rules.never_invent_details, true);
  assert.equal(cfg.rules.preserve_original_claim, true);
  assert.equal(cfg.rules.require_provenance_for_added_detail, true);
  assert.equal(cfg.rules.distinguish_source_text_from_analysis, true);
  assert.equal(cfg.cost_policy.paid_dependency_required, false);
});
