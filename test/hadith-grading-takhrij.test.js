import assert from 'node:assert/strict';
import test from 'node:test';
import { registerScholarGrade, registerTakhrij, summarizeHadithGrades, validateScholarGrade, validateTakhrij } from '../src/hadith-grading-takhrij.js';

test('requires sourced scholar grades', () => {
  const grade = { id: 'g1', hadithId: 'h1', scholar: 'Scholar', grade: 'sahih', sourceId: 'src1', citation: '1' };
  assert.equal(validateScholarGrade(grade).valid, true);
  assert.equal(validateScholarGrade({ ...grade, sourceId: '' }).valid, false);
});

test('rejects generated scholarly grades', () => {
  assert.throws(() => registerScholarGrade(new Map(), {
    id: 'g2', hadithId: 'h1', scholar: 'Scholar', grade: 'sahih', sourceId: 'src1', citation: '2', generated: true
  }), /generated-content-not-allowed/);
});

test('requires sourced takhrij entries', () => {
  const entry = { id: 't1', hadithId: 'h1', sourceId: 'src1', citation: 'book:1' };
  assert.equal(validateTakhrij(entry).valid, true);
  assert.equal(validateTakhrij({ ...entry, citation: '' }).valid, false);
});

test('prevents duplicate grade and takhrij identities', () => {
  const grades = new Map();
  const takhrij = new Map();
  const grade = { id: 'g3', hadithId: 'h1', scholar: 'Scholar', grade: 'hasan', sourceId: 'src1', citation: '3' };
  const entry = { id: 't3', hadithId: 'h1', sourceId: 'src1', citation: 'book:3' };
  registerScholarGrade(grades, grade);
  registerTakhrij(takhrij, entry);
  assert.throws(() => registerScholarGrade(grades, grade), /Duplicate scholar grade/);
  assert.throws(() => registerTakhrij(takhrij, entry), /Duplicate takhrij/);
});

test('summarizes existing grades without creating a new ruling', () => {
  const result = summarizeHadithGrades([
    { id: 'g4', hadithId: 'h1', scholar: 'A', grade: 'sahih', sourceId: 'src1', citation: '1' },
    { id: 'g5', hadithId: 'h1', scholar: 'B', grade: 'daif', sourceId: 'src2', citation: '2' }
  ]);
  assert.deepEqual(result, { count: 2, byGrade: { sahih: 1, daif: 1 } });
});
