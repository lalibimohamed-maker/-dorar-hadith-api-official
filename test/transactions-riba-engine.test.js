import assert from 'node:assert/strict';
import test from 'node:test';
import { routeTransactionQuestion, buildTransactionLesson } from '../src/transactions-riba-engine.js';

test('gold-for-gold questions route to transactions engine', () => {
  const result = routeTransactionQuestion('هل بيع الذهب بالذهب يدخل في الربا؟');
  assert.equal(result.engineId, 'fiqh-transactions');
  assert.equal(result.topicId, 'gold_silver');
});

test('orphan wealth questions route to prohibited wealth topic', () => {
  const result = routeTransactionQuestion('ما حكم أكل مال اليتيم؟');
  assert.equal(result.engineId, 'fiqh-transactions');
  assert.equal(result.topicId, 'forbidden_wealth');
});

test('transaction lessons expose evidence and warnings', () => {
  const lesson = buildTransactionLesson('riba_basics');
  assert.equal(lesson.engineId, 'fiqh-transactions');
  assert.ok(lesson.evidence.length > 0);
  assert.ok(lesson.lessons.length > 0);
});
