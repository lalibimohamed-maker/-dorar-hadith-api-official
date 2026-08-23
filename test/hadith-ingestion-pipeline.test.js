import assert from 'node:assert/strict';
import test from 'node:test';
import { getSource } from '../src/source-registry.js';
import { ingestBatch, ingestHadithRecord } from '../src/hadith-ingestion-pipeline.js';

const sourceId = 'dorar';
const source = getSource(sourceId);

assert.ok(source, 'fixture source must exist in the canonical registry');

test('accepts a source-registered pending hadith for review', () => {
  const result = ingestHadithRecord({
    id: 'h1', text: 'fixture', sourceId, citation: 'fixture:1',
    verificationState: 'pending', provenance: { citation: 'fixture:1', sourceId }
  });
  assert.equal(result.ingestionState, 'review');
});

test('rejects a hadith whose source is not registered', () => {
  assert.throws(() => ingestHadithRecord({
    id: 'h2', text: 'fixture', sourceId: 'missing-source', citation: 'fixture:2',
    verificationState: 'pending', provenance: { citation: 'fixture:2', sourceId: 'missing-source' }
  }), /source:not-registered/);
});

test('rejects generated content', () => {
  assert.throws(() => ingestHadithRecord({
    id: 'h3', text: 'fixture', sourceId, citation: 'fixture:3', generated: true,
    verificationState: 'source_verified', provenance: { citation: 'fixture:3', sourceId }
  }), /generated-content/);
});

test('batch ingestion separates accepted and rejected records', () => {
  const result = ingestBatch([
    { id: 'h4', text: 'ok', sourceId, citation: 'fixture:4', verificationState: 'pending', provenance: { citation: 'fixture:4', sourceId } },
    { id: 'h5', text: 'bad', sourceId: 'missing-source', citation: 'fixture:5', verificationState: 'pending', provenance: { citation: 'fixture:5', sourceId: 'missing-source' } }
  ]);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 1);
});
