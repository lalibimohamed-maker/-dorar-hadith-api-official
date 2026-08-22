const assert = require('assert');
const { loadCorpus, loadRouting } = require('../src/corpus_repository');

const records = loadCorpus();
const routing = loadRouting();

assert.ok(records.length > 0, 'corpus seed must contain records');
assert.ok(records.every(r => r.verification_state !== 'verified' || r.source_id), 'verified records require source');
assert.strictEqual(routing.verification.pendingCannotBePresentedAsVerified, true);
assert.strictEqual(routing.conceptResolution.longPressSeconds, 5);
assert.strictEqual(routing.bilingualSearch.enabledByUser, true);

console.log(`corpus repository tests: OK (${records.length} records)`);
