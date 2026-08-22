import assert from 'node:assert/strict';
import test from 'node:test';
import { getResearchTree } from '../src/hadith-scholar-linker.js';

test('paradise research tree links hadith evidence to Ibn al-Qayyim work', () => {
  const rows = getResearchTree('paradise');
  assert.ok(rows.length >= 3);
  assert.ok(rows.some((row) => row.scholarWorks.includes('حادي الأرواح إلى بلاد الأفراح')));
});

test('source linkage never implies authentication', () => {
  const rows = getResearchTree('eschatology');
  assert.ok(rows.some((row) => row.verificationStatus === 'requires_source_verification'));
  assert.ok(rows.every((row) => row.rule.includes('لا يساوي تصحيحها')));
});

console.log('Hadith-scholar linker OK');
