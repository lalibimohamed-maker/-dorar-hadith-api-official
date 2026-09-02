import test from 'node:test';
import assert from 'node:assert/strict';
import { canAutoDownload, chooseAutoAcquisition, buildAutoAcquisitionPlan } from '../src/rechercher-auto-acquisition.js';

test('auto-download requires verified redistributable rights and a concrete file URL', () => {
  assert.equal(canAutoDownload({
    rightsDecision: 'redistributable',
    rightsVerified: true,
    downloadUrl: 'https://example.org/book.pdf'
  }), true);

  assert.equal(canAutoDownload({
    rightsDecision: 'redistributable',
    rightsVerified: false,
    downloadUrl: 'https://example.org/book.pdf'
  }), false);
});

test('protected or unclear books never auto-download', () => {
  for (const rightsDecision of ['unclear', 'conflict', 'work-protected', 'read-only']) {
    assert.equal(canAutoDownload({
      rightsDecision,
      rightsVerified: true,
      downloadUrl: 'https://example.org/book.pdf'
    }), false);
  }
});

test('automatic acquisition falls back to a rights-cleared alternative edition', () => {
  const result = chooseAutoAcquisition({
    id: 'book-1',
    rightsDecision: 'edition-review',
    rightsVerified: false,
    sourceId: 'waqfeya',
    alternativeSources: [
      {
        sourceId: 'archive-org',
        rightsDecision: 'explicitly-licensed',
        rightsVerified: true,
        downloadUrl: 'https://example.org/cleared.pdf'
      }
    ]
  });
  assert.equal(result.outcome, 'AUTO_DOWNLOAD_ALTERNATIVE');
  assert.equal(result.sourceId, 'archive-org');
  assert.equal(result.downloadUrl, 'https://example.org/cleared.pdf');
});

test('plan routes unresolved books to read-only/link-only', () => {
  const plan = buildAutoAcquisitionPlan([
    { id: 'open-1', title: 'Open', rightsDecision: 'redistributable', rightsVerified: true, downloadUrl: 'https://example.org/open.pdf' },
    { id: 'unclear-1', title: 'Unclear', rightsDecision: 'unclear', rightsVerified: false, sourceId: 'princeton-islamic-mss' }
  ]);
  assert.equal(plan[0].outcome, 'AUTO_DOWNLOAD');
  assert.equal(plan[1].outcome, 'READ_ONLY_OR_LINK_ONLY');
});
