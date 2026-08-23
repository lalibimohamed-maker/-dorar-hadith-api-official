import assert from 'node:assert/strict';
import test from 'node:test';
import { createSourceRegistry } from '../src/source-registry.js';
import { ingestBatch, ingestHadithRecord } from '../src/hadith-ingestion-pipeline.js';

const source = {
  id: 'fixture-hadith',
  title: 'Fixture Hadith Source',
  type: 'hadith_collection',
  verificationState: 'source_verified',
  provenance: { citation: 'fixture:1', publisher: 'test' }
};

test('accepts a source-registered pending hadith for review', () => {
  const registry = createSourceRegistry([source]);
  const result = ingestHadithRecord(registry, {
    id: 'h1', text: 'fixture', sourceId: source.id, citation: '1',
    verificationState: 'pending', provenance: { citation: 'fixture:1', sourceUrl: 'https://example.invalid/source' }
  });
  assert.equal(result.ingestionState, 'review');
});

test('rejects a hadith whose source is not registered', () => {
  const registry = createSourceRegistry([source]);
  assert.throws(() => ingestHadithRecord(registry, {
    id: 'h2', text: 'fixture', sourceId: 'missing', citation: '2',
    verificationState: 'pending', provenance: { citation: 'fixture:2', sourceUrl: 'https://example.invalid/source' }
  }), /source:not-registered/);
});

test('rejects generated content', () => {
  const registry = createSourceRegistry([source]);
  assert.throws(() => ingestHadithRecord(registry, {
    id: 'h3', text: 'fixture', sourceId: source.id, citation: '3', generated: true,
    verificationState: 'source_verified', provenance: { citation: 'fixture:3', sourceUrl: 'https://example.invalid/source' }
  }), /generated-content/);
});

test('batch ingestion separates accepted and rejected records', () => {
  const registry = createSourceRegistry([source]);
  const result = ingestBatch(registry, [
    { id: 'h4', text: 'ok', sourceId: source.id, citation: '4', verificationState: 'pending', provenance: { citation: 'fixture:4', sourceUrl: 'https://example.invalid/source' } },
    { id: 'h5', text: 'bad', sourceId: 'missing', citation: '5', verificationState: 'pending', provenance: { citation: 'fixture:5', sourceUrl: 'https://example.invalid/source' } }
  ]);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 1);
});
