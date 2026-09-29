import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const engine = fs.readFileSync('scripts/rechercher_acquisition_engine.py', 'utf8');
const wrapper = fs.readFileSync('scripts/rechercher_sequential_acquisition.py', 'utf8');
const policy = fs.readFileSync('docs/rechercher-retryable-gap-policy.md', 'utf8');

test('missing expected-volume evidence remains retryable and not acquired', () => {
  assert.match(engine, /"blocked-missing-expected-volumes"/);
  assert.match(wrapper, /RETRYABLE_STATUSES\s*=\s*\{"blocked-missing-expected-volumes",\s*"partial"\}/);
  assert.match(engine, /return \{\s*"id": book_key\(book\),\s*"status": "blocked-missing-expected-volumes"/s);
});

test('incomplete source coverage is classified as retryable coverage state', () => {
  assert.match(engine, /"incomplete_source"/);
  assert.match(engine, /"source_error"/);
  assert.match(engine, /"download_error"/);
  assert.match(engine, /status = "partial"/);
  assert.match(engine, /"retryable": status == "partial"/);
});

test('PDF integrity and quality failures remain blocking', () => {
  assert.match(engine, /INTEGRITY_BLOCKING_ATTEMPT_STATUSES\s*=\s*\{"invalid_signature",\s*"invalid_pdf",\s*"quality_rejected"\}/);
  assert.match(engine, /"status":\s*"integrity-failed"/);
  assert.match(engine, /"retryable":\s*False/);
  assert.match(wrapper, /terminal_failures = statuses - RETRYABLE_STATUSES - \{"acquired"\}/);
});

test('catalog is restored after every acquisition run rather than deleting pending entries', () => {
  assert.match(wrapper, /finally:\s*restore_catalogs\(backups\)/);
  assert.match(wrapper, /"mode":\s*"pending-only"/);
});

test('policy documents retry without false acquisition success', () => {
  assert.match(policy, /never deleted/i);
  assert.match(policy, /integrity.*blocking/i);
  assert.match(policy, /not promoted to `acquired`/i);
});
