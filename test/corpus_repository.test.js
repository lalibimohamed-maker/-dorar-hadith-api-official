import assert from 'node:assert/strict';
import { loadCorpus, loadRouting } from '../src/corpus_repository.js';

const records = loadCorpus();
const routing = loadRouting();

assert.ok(records.length > 0, 'corpus seed must contain records');
assert.ok(records.every(r => typeof r.verification_state === 'string' && r.verification_state.length > 0), 'every corpus record must have an explicit verification state');
assert.ok(records.every(r => r.verification_state !== 'verified' || r.source_id), 'verified records require source');
assert.ok(records.filter(r => r.verification_state === 'pending_verification').length > 0, 'current seed must retain pending records until verification');
assert.equal(routing.verification.pendingCannotBePresentedAsVerified, true);
assert.equal(routing.conceptResolution.longPressSeconds, 5);
assert.equal(routing.bilingualSearch.enabledByUser, true);

console.log(`corpus repository tests: OK (${records.length} records)`);
