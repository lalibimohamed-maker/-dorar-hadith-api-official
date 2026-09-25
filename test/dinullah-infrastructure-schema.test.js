import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const schemaFiles = [
  'schemas/dinullah-core.schema.json',
  'schemas/dinullah-provenance-event.schema.json',
  'schemas/dinullah-source-record.schema.json',
  'config/dinullah-infrastructure-capabilities.json'
];

test('Dinullah infrastructure schemas are valid JSON and preserve governance enums', () => {
  for (const relative of schemaFiles) {
    const absolute = path.join(root, relative);
    const parsed = JSON.parse(fs.readFileSync(absolute, 'utf8'));
    assert.equal(typeof parsed, 'object');
  }

  const core = JSON.parse(fs.readFileSync(path.join(root, schemaFiles[0]), 'utf8'));
  assert.deepEqual(core.properties.rights.properties.status.enum, [
    'public', 'licensed', 'review_required', 'restricted', 'unknown'
  ]);

  const source = JSON.parse(fs.readFileSync(path.join(root, schemaFiles[2]), 'utf8'));
  assert.ok(source.properties.capabilities.properties.pdf);
  assert.ok(source.properties.capabilities.properties.docx);
});

test('locked platform scope is present and defines the eight implementation phases',()=>{
  const scope=fs.readFileSync('docs/DINULLAH-PLATFORM-SCOPE.md','utf8');
  for(const term of [
    'Global Sources',
    'Source Graph',
    'Provenance / W3C PROV',
    'Work / Edition / Author / Scholar Graph',
    'Evidence Graph',
    'Curated Corpus',
    'Knowledge Graph',
    'Multilingual Search',
    'Research API',
    'SDK',
    'CLI',
    'MCP',
    'Datasets',
    'Digital Library',
    'V1 — Foundation',
    'V8 — Public Islamic Research Infrastructure'
  ]) assert.ok(scope.includes(term), `scope missing: ${term}`);
});

test('capability registry declares the locked scope without bypassing rights boundaries',()=>{
  const caps=JSON.parse(fs.readFileSync('config/dinullah-infrastructure-capabilities.json','utf8'));
  assert.equal(caps.scope.locked,true);
  assert.equal(caps.scope.canonical_document,'docs/DINULLAH-PLATFORM-SCOPE.md');
  assert.equal(caps.layers.source.includes('discovery-engine'),true);
  assert.equal(caps.layers.evidence.includes('claim-evidence-source'),true);
  assert.equal(caps.layers.knowledge.includes('edition-graph'),true);
  assert.equal(caps.layers.delivery.includes('mcp'),true);
  assert.equal(caps.rights_policy.unknown,'do_not_redistribute');
});
