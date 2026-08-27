import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const configPath = path.join(root, 'config/security-framework-map-2026.json');

test('security framework map is valid JSON and fail-closed', () => {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(config.principles.failClosed, true);
  assert.equal(config.principles.leastPrivilege, true);
  assert.equal(config.principles.independentReview, true);
  assert.equal(config.principles.noDestructiveAutonomousResponse, true);
});

test('article security domains are represented', () => {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  for (const key of [
    'protection_systems',
    'malware',
    'network_and_transport',
    'application_security',
    'adversary_detection',
    'supply_chain',
    'incident_response',
    'content_and_corpus',
    'updates'
  ]) {
    assert.ok(config.articleTopics[key]?.controls?.length > 0, `missing controls for ${key}`);
  }
});

test('optional external sensors are never represented as installed by the repository', () => {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  for (const name of ['Wazuh', 'Falco']) {
    assert.equal(config.externalSystems[name].mustNotBeClaimedInstalledByRepo, true);
    assert.equal(config.externalSystems[name].status, 'optional-external-deployment');
  }
});

test('emergency and imported-content boundaries are explicit', () => {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.ok(config.evidenceStandards.some((x) => x.includes('Emergency')));
  assert.ok(config.evidenceStandards.some((x) => x.includes('Imported scholarly material')));
  assert.ok(config.articleTopics.content_and_corpus.controls.includes('corpus-write-boundary'));
});
