import assert from 'node:assert/strict';
import { auditSources, assertSourceContract } from '../src/source-provenance-audit.js';

const report = assertSourceContract();

assert.ok(report.counts.total > 0, 'source registry must contain sources');
assert.equal(report.issues.filter(i => i.code === 'MISSING_SOURCE_ID').length, 0);
assert.equal(report.issues.filter(i => i.code === 'INCOMPLETE_IDENTITY').length, 0);
assert.equal(report.issues.filter(i => i.code === 'INVALID_URL').length, 0);
assert.equal(report.issues.filter(i => i.code === 'DUPLICATE_SOURCE_ID').length, 0);
assert.ok(report.sources.every(s => s.attribution.required === true));
assert.ok(report.sources.every(s => s.attribution.noEndorsementByInclusion === true));
assert.ok(Object.keys(report.counts.byType).length > 0, 'source types must be classified');

const audited = auditSources();
assert.deepEqual(audited.counts, report.counts);

console.log(`source provenance audit: OK (${report.counts.total} sources)`);
