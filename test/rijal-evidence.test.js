import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyRijalStatement, compareNarratorStatements, createRijalStatement, summarizeNarratorEvidence, validateNarratorRecord } from '../src/rijal-evidence.js';

test('classifies common rijal wording without creating a final verdict', () => {
  assert.equal(classifyRijalStatement('ثقة ثبت'), 'taadil');
  assert.equal(classifyRijalStatement('ضعيف الحديث'), 'jarh');
  assert.equal(classifyRijalStatement('ثقة لكنه ضعيف في هذا الباب'), 'mixed');
  assert.equal(classifyRijalStatement('له كلام في هذا الموضع'), 'uncategorized');
});

test('requires critic and source for every scholarly statement', () => {
  assert.throws(() => createRijalStatement({ statementId: 'x', text: 'ثقة' }), /Invalid rijal statement/);
  const statement = createRijalStatement({
    statementId: 's1', critic: 'ناقد', sourceId: 'rijal-book', reference: '1/10', text: 'ثقة'
  });
  assert.equal(statement.classification, 'taadil');
});

test('preserves independent statements and identity uncertainty', () => {
  const record = {
    narratorId: 'rawi:1', primaryName: 'راوٍ', identityStatus: 'disputed',
    statements: [
      { statementId: 's1', critic: 'ناقد أ', sourceId: 'book-a', reference: '1/1', text: 'ثقة', classification: 'taadil' },
      { statementId: 's2', critic: 'ناقد ب', sourceId: 'book-b', reference: '2/2', text: 'ضعيف', classification: 'jarh' }
    ]
  };
  assert.equal(validateNarratorRecord(record).valid, true);
  const summary = summarizeNarratorEvidence(record);
  assert.equal(summary.identityStatus, 'disputed');
  assert.deepEqual(summary.critics, ['ناقد أ', 'ناقد ب']);
  assert.deepEqual(summary.classifications, ['taadil', 'jarh']);
  assert.equal(compareNarratorStatements(record).every((x) => x.isIndependentEvidence), true);
});
