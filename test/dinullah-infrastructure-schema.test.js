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
