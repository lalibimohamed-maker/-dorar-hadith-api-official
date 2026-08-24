import test from 'node:test';
import assert from 'node:assert/strict';
import { canExport } from '../src/digital-book-pipeline.js';
import { RIGHTS } from '../src/book-rights-resolver.js';

for (const denied of [
  RIGHTS.READ_ONLY,
  RIGHTS.READ_COPY,
  RIGHTS.LINK_ONLY,
  RIGHTS.RIGHTS_UNCLEAR,
  RIGHTS.RESTRICTED,
]) {
  test(`denies every export for ${denied}`, () => {
    for (const format of ['pdf', 'docx', 'pptx']) {
      assert.equal(canExport({ rights: denied }, format), false);
    }
  });
}

test('allows all supported exports only for redistributable books', () => {
  for (const format of ['pdf', 'docx', 'pptx']) {
    assert.equal(canExport({ rights: RIGHTS.REDISTRIBUTABLE }, format), true);
  }
});

test('rejects unsupported export formats', () => {
  assert.equal(canExport({ rights: RIGHTS.REDISTRIBUTABLE }, 'txt'), false);
});
