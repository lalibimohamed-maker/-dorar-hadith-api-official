import test from 'node:test';
import assert from 'node:assert/strict';
import { routeConcept, filterConceptKnowledge } from '../src/methodology-router.js';

test('aqidah concept defaults to Sunni primary source layer', () => {
  const result = routeConcept({ id: 'concept:iman-billah', domain: 'aqidah' });
  assert.equal(result.mode, 'sunni_primary');
  assert.equal(result.comparative, false);
  assert.equal(result.scholarRules.comparativeTheologySeparateLayer, true);
});

test('comparative layer is explicit and opt-in', () => {
  const result = routeConcept({ domain: 'aqidah' }, { comparative: true });
  assert.equal(result.mode, 'sunni_primary_plus_comparative');
  assert.equal(result.comparative, true);
});

test('aqidah knowledge separates comparative sources', () => {
  const knowledge = { sources: [
    { title: 'Quran', creedRole: 'primary_sunni' },
    { title: 'Comparative source', creedRole: 'comparative' },
    { title: 'Non-primary source', creedRole: 'non_sunni' }
  ] };
  const primary = filterConceptKnowledge(knowledge, 'aqidah', false);
  assert.equal(primary.sources.length, 1);
  assert.equal(primary.sources[0].title, 'Quran');
  const withComparison = filterConceptKnowledge(knowledge, 'aqidah', true);
  assert.equal(withComparison.comparative_sources.length, 2);
});
