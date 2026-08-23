import assert from 'node:assert/strict';
import test from 'node:test';
import { validateHadith, normalizeHadith, isVerifiedHadith } from '../src/hadith-corpus-contract.js';

test('valid source-backed hadith normalizes without changing semantic fields', () => {
  const input = { id:'h:1', text:'حديث تجريبي', sourceId:'fixture', citation:'1', verificationState:'source_verified', narrators:['n:1'] };
  const result = normalizeHadith(input);
  assert.equal(result.id, 'h:1');
  assert.deepEqual(result.narrators, ['n:1']);
  assert.equal(isVerifiedHadith(result), true);
});

test('missing source identity is rejected', () => {
  const result = validateHadith({ id:'h:1', text:'x', verificationState:'pending', citation:'1' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('missing:sourceId'));
});

test('generated religious text cannot enter the hadith corpus', () => {
  const result = validateHadith({ id:'h:1', text:'generated', sourceId:'ai', citation:'generated', verificationState:'source_verified', generated:true });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('generated-content-not-allowed'));
});

test('pending records are allowed for ingestion review but are not verified', () => {
  const record = { id:'h:2', text:'x', sourceId:'book', citation:'p. 1', verificationState:'pending' };
  assert.equal(validateHadith(record).valid, true);
  assert.equal(isVerifiedHadith(record), false);
});
