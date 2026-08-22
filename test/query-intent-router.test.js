import assert from 'node:assert/strict';
import { classifyQuery, queryPolicy } from '../src/query-intent-router.js';

assert.equal(classifyQuery('ما الحياة البرزخية؟').intent, 'ghaib');
assert.equal(classifyQuery('قصص الأنبياء في الكتاب والسنة').intent, 'quran_stories');
assert.equal(classifyQuery('ما تعريف الصلاة؟').intent, 'definition');
assert.equal(queryPolicy('ما عذاب القبر من القرآن والسنة؟').evidenceRequired, true);
assert.equal(queryPolicy('ما عذاب القبر من القرآن والسنة؟').rejectUnverifiedAsFact, true);
console.log('query intent policy tests: OK');
