import test from 'node:test';
import assert from 'node:assert/strict';
import { RIGHTS, resolveRights } from '../src/book-rights-resolver.js';

test('free availability alone is not redistribution permission', () => {
  assert.equal(resolveRights([{ source: 'example', kind: 'free-download' }]).status, RIGHTS.RIGHTS_UNCLEAR);
});

test('explicit redistribution permission is accepted', () => {
  assert.equal(resolveRights([{ source: 'publisher', kind: 'explicit-redistribution-permission' }]).status, RIGHTS.REDISTRIBUTABLE);
});

test('read-only and read-copy permissions are distinguished', () => {
  assert.equal(resolveRights([{ source: 'library', kind: 'read-only-permission' }]).status, RIGHTS.READ_ONLY);
  assert.equal(resolveRights([{ source: 'library', kind: 'read-copy-permission' }]).status, RIGHTS.READ_COPY);
});

test('waqf does not imply redistribution unless the evidence says so', () => {
  assert.equal(resolveRights([{ source: 'waqf-site', kind: 'waqf' }]).status, RIGHTS.RIGHTS_UNCLEAR);
  assert.equal(resolveRights([{ source: 'waqf-site', kind: 'waqf', allowsRedistribution: true }]).status, RIGHTS.REDISTRIBUTABLE);
});
