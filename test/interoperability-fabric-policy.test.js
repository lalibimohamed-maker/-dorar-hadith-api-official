import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const configPath = path.join(root, 'config/interoperability-fabric-2026.json');

test('interoperability fabric is fail-closed and open-source scoped', () => {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(Array.isArray(config.components), true);
  assert.ok(config.components.length >= 4);
  assert.equal(config.integration_rules.some((x) => x.includes('proprietary')), true);
  assert.equal(config.integration_rules.some((x) => x.includes('upstream license')), true);
});

test('required interoperability capabilities are represented', () => {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const capabilities = new Set(config.components.map((x) => x.capability));
  for (const capability of [
    'dataflow-orchestration',
    'digital-twin-and-device-interoperability',
    'messaging-fabric',
    '3d-scene-interchange'
  ]) {
    assert.equal(capabilities.has(capability), true, `missing ${capability}`);
  }
});

test('no component is treated as installed merely by being registered', () => {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  for (const component of config.components) {
    assert.equal(component.activation, 'candidate-until-runtime-deployment');
  }
});
