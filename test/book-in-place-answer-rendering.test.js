import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync('config/book-in-place-answer-rendering-2026.json', 'utf8'));

test('preserves source page geometry and surrounding content', () => {
  assert.equal(config.inputInvariant.preserveOriginalPageGeometry, true);
  assert.equal(config.inputInvariant.preserveOriginalVisibleContent, true);
  assert.equal(config.inputInvariant.neverReplaceWholePage, true);
});

test('answers are anchored to the original answer region', () => {
  assert.equal(config.answerPlacement.anchor, 'original_answer_region');
  assert.equal(config.answerPlacement.numberAnswers, true);
  assert.equal(config.answerPlacement.keepExistingQuestionAndContext, true);
  assert.equal(config.answerPlacement.rtl, true);
});

test('does not allow overflow to rewrite unrelated page content', () => {
  assert.equal(config.answerPlacement.collisionCheck, true);
  assert.match(config.answerPlacement.overflowPolicy, /needs_review/);
  assert.equal(config.answerPlacement.neverMoveOtherPageContent, true);
});

test('requires post-render integrity checks', () => {
  assert.equal(config.qualityGates.noTextOutsideTargetRegionChanged, true);
  assert.equal(config.qualityGates.noQuestionTextChanged, true);
  assert.equal(config.qualityGates.postRenderOcrRoundTripRequired, true);
  assert.equal(config.qualityGates.unresolvedAnswerIsNeverGuessed, true);
});
