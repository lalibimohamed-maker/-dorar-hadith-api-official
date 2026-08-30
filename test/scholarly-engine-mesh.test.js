import test from 'node:test';
import assert from 'node:assert/strict';
import mesh from '../config/scholarly-engine-mesh-2026.json' with { type: 'json' };
import { classifyDiscovery, evaluatePublicationGates, validateEngineMesh } from '../src/scholarly-engine-mesh.js';

test('engine mesh uses redundancy and remains fail-closed', () => {
  const result = validateEngineMesh(mesh);
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.equal(mesh.decisions.publish, 'blocked-until-all-required-gates-pass');
});

test('publication requires every gate', () => {
  assert.equal(evaluatePublicationGates({ provenance: true, evidence: true, rights: true, schema: true, review: true }).publishable, true);
  assert.equal(evaluatePublicationGates({ provenance: true, evidence: true, rights: false, schema: true, review: true }).publishable, false);
});

test('discovery states progress only after corroboration and review', () => {
  assert.equal(classifyDiscovery({}), 'unreviewed');
  assert.equal(classifyDiscovery({ discovered: true }), 'discovered');
  assert.equal(classifyDiscovery({ discovered: true, corroborated: true }), 'corroborated');
  assert.equal(classifyDiscovery({ discovered: true, corroborated: true, scholarlyReviewed: true }), 'scholarly-reviewed');
  assert.equal(classifyDiscovery({ discovered: true, corroborated: true, scholarlyReviewed: true, rightsCleared: true }), 'publishable');
});
