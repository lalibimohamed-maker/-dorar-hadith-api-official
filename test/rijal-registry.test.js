import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyJudgment, getRijalSource, listRijalSources, summarizeNarratorEvidence, validateNarratorJudgment } from '../src/rijal-registry.js';

test('rijal registry contains the declared core sources', () => {
  const sources = listRijalSources();
  assert.ok(sources.length >= 7);
  assert.equal(getRijalSource('rijal:al-jarh-wa-al-tadil').title, 'الجرح والتعديل');
});

test('judgment classification is explicit and does not create a final verdict', () => {
  assert.equal(classifyJudgment('ثقة ثبت').category, 'taadil');
  assert.equal(classifyJudgment('ضعيف متروك').category, 'jarh');
  assert.equal(classifyJudgment('ثقة لكنه ضعيف في هذا الباب').category, 'mixed');
  assert.equal(classifyJudgment('قول يحتاج إلى مراجعة').category, 'unclassified');
});

test('narrator evidence requires critic, source and citation', () => {
  const valid = validateNarratorJudgment({
    recordId: 'rijal:evidence:1', narratorId: 'narrator:1', criticId: 'critic:1',
    sourceId: 'rijal:al-jarh-wa-al-tadil', citation: '1/1', judgmentText: 'ثقة'
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.attributed, true);
  assert.equal(valid.classification.category, 'taadil');

  const invalid = validateNarratorJudgment({ narratorId: 'narrator:1', judgmentText: 'ثقة' });
  assert.equal(invalid.valid, false);
});

test('conflicting evidence remains separately countable', () => {
  const summary = summarizeNarratorEvidence([
    { criticId: 'critic:a', sourceId: 'rijal:al-jarh-wa-al-tadil', judgmentText: 'ثقة' },
    { criticId: 'critic:b', sourceId: 'rijal:mizan-al-itidal', judgmentText: 'ضعيف' }
  ]);
  assert.equal(summary.total, 2);
  assert.equal(summary.taadil, 1);
  assert.equal(summary.jarh, 1);
  assert.deepEqual(summary.critics, ['critic:a', 'critic:b']);
});
