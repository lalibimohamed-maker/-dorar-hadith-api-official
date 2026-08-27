import test from 'node:test';
import assert from 'node:assert/strict';
import { extractQuestionAnswerBlocks, mergeOcrCandidates } from '../src/books/book-semantic-qna-reconstructor.mjs';

test('extracts Arabic question/answer headings without declaring authority', () => {
  const blocks = extractQuestionAnswerBlocks('السؤال: لماذا وقع كذا؟\nالجواب: لأن المصدر يذكر ذلك.');
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].heading, 'السؤال');
  assert.equal(blocks[1].heading, 'الجواب');
  assert.equal(blocks[1].authoritative, false);
});

test('keeps OCR candidates non-authoritative and records alternatives', () => {
  const result = mergeOcrCandidates([{ text: 'نص أول' }, { text: 'نص ثان' }]);
  assert.equal(result.authoritative, false);
  assert.equal(result.consensus, true);
  assert.deepEqual(result.alternatives, ['نص ثان']);
});

test('rejects empty OCR evidence', () => {
  assert.throws(() => mergeOcrCandidates([{ text: '   ' }]), /No usable OCR candidate/);
});
