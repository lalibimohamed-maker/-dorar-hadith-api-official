import test from 'node:test';
import assert from 'node:assert/strict';
import { BOOK_SOURCE_PROFILES, getBookSourceProfile } from '../src/book-source-profiles.js';

test('official government sources are registered as discovery sources', () => {
  for (const id of [
    'qatar-awqaf-ebooks',
    'qatar-quran',
    'kuwait-awqaf',
    'kuwait-awqaf-books',
    'saudi-moia',
    'saudi-islamic-library',
  ]) {
    const profile = getBookSourceProfile(id);
    assert.ok(profile);
    assert.ok(profile.capabilities.includes('official'));
    assert.equal(profile.defaultRights, 'rights-unclear');
    assert.match(profile.homepage, /^https:\/\//);
  }
});

test('all source profiles remain explicit about rights', () => {
  assert.ok(BOOK_SOURCE_PROFILES.length >= 9);
  for (const profile of BOOK_SOURCE_PROFILES) {
    assert.equal(typeof profile.defaultRights, 'string');
  }
});
