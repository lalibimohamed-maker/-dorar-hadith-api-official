import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_BOOK_FORMATS,
  BOOK_FETCH_MAX_BYTES,
  governedBookFetchPolicy,
  planBookFetch,
  validateBookFetchMetadata
} from '../src/governed-book-fetch-plan.js';

const good = {
  sourceConnector: { status: 'passed', verified: true },
  source: { sourceId: 'source-1', resourceId: 'book-copy-1' },
  provenance: { sourceId: 'source-1', resourceId: 'book-copy-1', verifiedAt: '2026-09-28T00:00:00Z' },
  rights: { status: 'redistributable' },
  validation: { status: 'passed' }
};

test('policy is planning-only and capped at 25 MiB', () => {
  const policy = governedBookFetchPolicy();
  assert.equal(policy.maxBytes, 25 * 1024 * 1024);
  assert.deepEqual(policy.allowedFormats, ['pdf', 'text', 'epub']);
  assert.equal(policy.networkExecution, false);
  assert.equal(policy.storageExecution, false);
  assert.equal(policy.contentInspection, false);
});

test('valid metadata accepts PDF, plain text and EPUB', () => {
  assert.equal(validateBookFetchMetadata({
    url: 'https://example.org/book.pdf',
    contentType: 'application/pdf',
    contentLengthBytes: BOOK_FETCH_MAX_BYTES
  }).passed, true);

  assert.equal(validateBookFetchMetadata({
    url: 'https://example.org/book.txt',
    contentType: 'text/plain',
    contentLengthBytes: 1024
  }).passed, true);

  assert.equal(validateBookFetchMetadata({
    url: 'https://example.org/book.epub',
    contentType: 'application/epub+zip',
    contentLengthBytes: 2048
  }).passed, true);
});

test('missing or unsafe URL, type and size are blocked', () => {
  const result = validateBookFetchMetadata({
    url: 'http://example.org/book.pdf',
    contentType: 'application/octet-stream',
    contentLengthBytes: BOOK_FETCH_MAX_BYTES + 1
  });
  assert.equal(result.passed, false);
  assert.match(result.failures.join(','), /https_url_required/);
  assert.match(result.failures.join(','), /content_type_not_allowed/);
  assert.match(result.failures.join(','), /content_length_exceeds_25_mib/);
});

test('format must agree with the declared content type', () => {
  const result = validateBookFetchMetadata({
    url: 'https://example.org/book.pdf',
    contentType: 'text/plain',
    contentLengthBytes: 100,
    format: 'pdf'
  });
  assert.equal(result.passed, false);
  assert.match(result.failures.join(','), /format_content_type_mismatch/);
});

test('fetch planning is blocked unless source, provenance, rights and validation all pass', () => {
  const blocked = planBookFetch({
    ...good,
    sourceConnector: { status: 'failed', verified: false },
    metadata: {
      url: 'https://example.org/book.pdf',
      contentType: 'application/pdf',
      contentLengthBytes: 100
    }
  });
  assert.equal(blocked.state, 'blocked');
  assert.equal(blocked.allowed, false);
});

test('a complete governed source yields a plan and performs no fetch', () => {
  const plan = planBookFetch({
    ...good,
    metadata: {
      url: 'https://example.org/book.pdf',
      contentType: 'application/pdf; charset=binary',
      contentLengthBytes: 1024,
      format: 'pdf'
    }
  });
  assert.equal(plan.state, 'planned');
  assert.equal(plan.allowed, true);
  assert.equal(plan.format, 'pdf');
  assert.equal(plan.performsHttpFetch, false);
  assert.equal(plan.writesStorage, false);
  assert.equal(plan.inspectsContent, false);
});

test('licensed and public-domain rights are eligible for planning', () => {
  for (const status of ['licensed', 'public-domain']) {
    const plan = planBookFetch({
      ...good,
      rights: { status },
      metadata: {
        url: 'https://example.org/book.epub',
        contentType: ALLOWED_BOOK_FORMATS.epub[0],
        contentLengthBytes: 4096,
        format: 'epub'
      }
    });
    assert.equal(plan.allowed, true);
  }
});

test('no downstream layer can infer permission from a missing rights state', () => {
  const plan = planBookFetch({
    ...good,
    rights: { status: 'unknown' },
    metadata: {
      url: 'https://example.org/book.txt',
      contentType: 'text/plain',
      contentLengthBytes: 10
    }
  });
  assert.equal(plan.state, 'blocked');
  assert.equal(plan.allowed, false);
});
