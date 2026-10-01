import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const registry = JSON.parse(fs.readFileSync(
  'config/rechercher/research-infrastructure-registry-2026.json',
  'utf8'
));

test('research infrastructure registry activates only new, additive layers', () => {
  const discovery = new Set(registry.discovery_sources.filter((x) => x.enabled).map((x) => x.id));
  assert.deepEqual([...discovery].sort(), ['openalex', 'opencitations']);
  assert.equal(registry.activation_contract.corpus_boundary.includes('directly'), true);
});

test('research derivatives are never canonical witnesses or direct Corpus writers', () => {
  for (const tool of registry.processing_tools) {
    assert.equal(tool.enabled, true);
    assert.equal(tool.canonical_witness, false);
    assert.equal(tool.corpus_write, false);
  }
});

test('the three research tools are distinct and named explicitly', () => {
  assert.deepEqual(
    registry.processing_tools.map((x) => x.id).sort(),
    ['escriptorium', 'grobid', 'kraken']
  );
});
