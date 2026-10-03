import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertTransition,
  canTransition,
  createFederationEnvelope,
  isReleaseBacked,
  normalizeSourceIdentity,
} from '../src/rechercher/federation-network-contract.js';

test('federation network preserves source identity and registry boundary', () => {
  const source = normalizeSourceIdentity({
    id: 'example-source',
    name: 'Example Source',
    country: 'DZ',
    connector: { kind: 'rest-json' },
    rightsPolicy: 'source-declared',
  }, 'country');

  assert.equal(source.registry, 'country');
  assert.equal(source.country, 'DZ');
  assert.equal(source.connectorKind, 'rest-json');
});

test('federation lifecycle is fail-closed and ordered', () => {
  assert.equal(canTransition('discovered', 'metadata_verified'), true);
  assert.equal(canTransition('discovered', 'release_backed'), false);
  assert.throws(() => assertTransition('discovered', 'runtime_active'), /Invalid federation transition/);
});

test('federation envelope separates provenance and rights from acquisition state', () => {
  const envelope = createFederationEnvelope({
    source: { id: 'source-1', name: 'Source 1', connector: { kind: 'web-discovery' } },
    registry: 'global',
    provenance: { sourceUrl: 'https://example.org/item', method: 'web-discovery' },
    rights: { state: 'unknown' },
  });

  assert.equal(envelope.status, 'discovered');
  assert.equal(envelope.rights.redistributable, false);
  assert.equal(envelope.artifact, null);
});

test('release-backed state requires release, URI and SHA-256', () => {
  assert.equal(isReleaseBacked({
    status: 'release_backed',
    artifact: {
      uri: 'https://example.org/release/item.pdf',
      sha256: 'a'.repeat(64),
      releaseTag: 'v1.0.0',
    },
  }), true);
  assert.equal(isReleaseBacked({
    status: 'release_backed',
    artifact: { uri: 'x', sha256: 'bad', releaseTag: 'v1' },
  }), false);
});
