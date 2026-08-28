import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const path = 'config/media-tool-discovery-registry-2026.json';

test('tool discovery is automatic but installation is fail-closed', () => {
  const cfg = JSON.parse(fs.readFileSync(path, 'utf8'));
  assert.equal(cfg.policy.discoverAutomatically, true);
  assert.equal(cfg.policy.installAutomatically, false);
  assert.equal(cfg.policy.promoteAutomatically, false);
  assert.equal(cfg.policy.requireProtectedPRForUpdates, true);
});

test('media capabilities use explicit upstream identities', () => {
  const cfg = JSON.parse(fs.readFileSync(path, 'utf8'));
  for (const capability of cfg.capabilities) {
    const upstreams = capability.upstreams ?? (capability.upstream ? [capability.upstream] : []);
    assert.ok(upstreams.length > 0, `missing upstream for ${capability.id}`);
    for (const upstream of upstreams) assert.match(upstream, /^https:\/\/github\.com\/[^/]+\/[^/]+$/);
  }
});

test('unknown or arbitrary systems cannot become trusted automatically', () => {
  const cfg = JSON.parse(fs.readFileSync(path, 'utf8'));
  assert.equal(cfg.policy.unknownProjectIsUntrusted, true);
  assert.ok(cfg.prohibitedAutoActions.includes('download-and-execute-unknown-binary'));
  assert.ok(cfg.prohibitedAutoActions.includes('install-unreviewed-system'));
  assert.ok(cfg.prohibitedAutoActions.includes('change-main-without-protected-pr'));
});
