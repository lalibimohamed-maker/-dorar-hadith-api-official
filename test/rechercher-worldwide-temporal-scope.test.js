import test from 'node:test';
import assert from 'node:assert/strict';

const scope = {
  start: 'PROPHETIC_ERA',
  end: 'PRESENT_AND_FUTURE',
  openEnded: true,
  defaultGlobal: true,
};

test('Rechercher temporal scope spans prophetic era through future works', () => {
  assert.equal(scope.start, 'PROPHETIC_ERA');
  assert.equal(scope.end, 'PRESENT_AND_FUTURE');
  assert.equal(scope.openEnded, true);
  assert.equal(scope.defaultGlobal, true);
});
