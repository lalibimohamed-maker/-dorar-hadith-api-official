import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const configPath = path.join(root, 'config/global/global-system-readiness-2026.json');

const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));

test('global readiness contract is fail-closed', () => {
  assert.equal(cfg.freeFirst, true);
  assert.equal(cfg.paidDependencyRequired, false);
  assert.equal(cfg.mergePolicy.requiresCiEvidence, true);
  assert.equal(cfg.mergePolicy.requiresCorpusBoundaryIntact, true);
  assert.equal(cfg.mergePolicy.requiresRightsGateIntact, true);
  assert.equal(cfg.mergePolicy.requiresProvenanceIntact, true);
  assert.equal(cfg.security.remoteContentUntrusted, true);
  assert.equal(cfg.security.failClosedOnAmbiguity, true);
  assert.equal(cfg.futureDiscovery.noSilentCapabilityRegression, true);
});

test('global capability map remains present', () => {
  for (const [domain, required] of Object.entries({
    search: ['globalFederation', 'specialistDispatch', 'claimEvidenceLinking'],
    books: ['preserveSource', 'historicalRestoration', 'multiEngineOcr'],
    translation: ['ensemble', 'contextAware', 'dictionaryMesh', 'translationMemory'],
    memory: ['browserCache', 'sharedContentCache', 'studyCalendar'],
    security: ['leastPrivilege', 'actionPinning']
  })) {
    for (const key of required) assert.equal(cfg[domain][key], true, `${domain}.${key} missing`);
  }
});
