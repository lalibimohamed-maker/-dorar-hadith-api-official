import test from 'node:test';
import assert from 'node:assert/strict';
import { extractStatements, validateStatementCandidate, groupStatementCandidates } from '../src/research/statement-extraction-engine.js';

test('extracts attributed statement candidates without declaring truth', () => {
  const result = extractStatements('قال الإمام فلان: هذا مثال للنص.', {
    sourceId: 'book-1', page: 12, url: 'https://example.invalid/source'
  });
  assert.ok(result.length >= 1);
  assert.equal(result[0].type, 'attributed_statement');
  assert.equal(result[0].extractionConfidence, 'candidate');
});

test('requires provenance before a statement can enter evidence grouping', () => {
  assert.equal(validateStatementCandidate({ type: 'attributed_statement', statement: 'نص' }), false);
  assert.equal(validateStatementCandidate({
    type: 'attributed_statement', statement: 'نص',
    provenance: { sourceId: 's1', page: 4 }
  }), true);
});

test('groups equivalent extracted statements while retaining all candidates', () => {
  const grouped = groupStatementCandidates([
    { type: 'attributed_statement', statement: 'قول  واحد', provenance: { sourceId: 'a', page: 1 } },
    { type: 'attributed_statement', statement: 'قول واحد', provenance: { sourceId: 'b', page: 2 } }
  ]);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].length, 2);
});
