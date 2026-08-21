import assert from 'node:assert/strict';
import test from 'node:test';

const source = await import('../src/dorar-client.js');

test('searchDorar rejects an empty query', async () => {
  await assert.rejects(() => source.searchDorar(''), /Search query is required/);
});

test('searchDorar is exported', () => {
  assert.equal(typeof source.searchDorar, 'function');
});
