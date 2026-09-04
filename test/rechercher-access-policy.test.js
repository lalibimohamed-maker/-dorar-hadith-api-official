import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAccess, chooseLanguageEdition, buildStudyViewerPolicy } from '../src/rechercher-access-policy.js';

test('restricted/unproven material remains viewable and copyable but not downloadable', () => {
  const access = resolveAccess('underlying-work-protected');
  assert.equal(access.view, true);
  assert.equal(access.selectable, true);
  assert.equal(access.copy, true);
  assert.equal(access.download, false);
  assert.equal(access.bulkExport, false);
});

test('conflicted rights never enable download', () => {
  const access = resolveAccess('conflict');
  assert.equal(access.download, false);
  assert.equal(access.bulkExport, false);
});

test('full access still forbids bulk export by default', () => {
  const access = resolveAccess('explicitly-licensed');
  assert.equal(access.view, true);
  assert.equal(access.selectable, true);
  assert.equal(access.copy, true);
  assert.equal(access.bulkExport, false);
});

test('language router chooses a rights-reviewed translation for the browser language', () => {
  const book = {
    language: 'ar',
    languageEditions: [
      { language: 'fr', translationOf: 'book-1', translationMode: 'licensed-translation', rightsDecision: 'explicitly-licensed' },
      { language: 'en', translationOf: 'book-1', translationMode: 'machine-translation', rightsDecision: 'unclear' }
    ]
  };
  const fr = chooseLanguageEdition(book, 'fr');
  assert.equal(fr.mode, 'licensed-translation');
  assert.equal(fr.authoritative, true);

  const de = chooseLanguageEdition(book, 'de');
  assert.equal(de.mode, 'unavailable');
  assert.equal(de.authoritative, false);
});

test('viewer exposes text selection/copy while blocking original download', () => {
  const policy = buildStudyViewerPolicy({
    rightsDecision: 'read-only',
    language: 'ar',
    sourceUrl: 'https://example.org/book'
  }, 'ar');
  assert.equal(policy.controls.textSelection, true);
  assert.equal(policy.controls.copySelectedText, true);
  assert.equal(policy.controls.downloadOriginal, false);
  assert.equal(policy.controls.bulkExport, false);
});
