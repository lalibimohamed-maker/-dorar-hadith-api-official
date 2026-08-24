import test from 'node:test';
import assert from 'node:assert/strict';
import { registerSearchProvider, listSearchProviders, buildSearchQueries, discoverAcrossProviders, rankSearchResults } from '../src/multi-source-search.js';

test('search providers are pluggable without changing corpus logic', async () => {
  registerSearchProvider({ id:'test-provider', name:'Test provider', languages:['ar','en'], capabilities:['web-search'], search: async ({text}) => [{url:'https://example.org/book/#section', title:text, sourceType:'official', redistributionAllowed:false}] });
  assert.ok(listSearchProviders().some((item) => item.id === 'test-provider'));
  const results = await discoverAcrossProviders('تفسير', { providerIds:['test-provider'] });
  assert.equal(results.length, 1); assert.equal(results[0].rightsStatus, 'rights-unclear'); assert.equal(results[0].redistributionAllowed, false); assert.equal(results[0].provenance.discoveryProvider, 'test-provider');
});

test('query planner keeps the original query and removes duplicate variants', () => {
  const queries = buildSearchQueries('Quran', { variants:['Quran','القرآن'] });
  assert.deepEqual(queries.map((q) => q.text), ['Quran','القرآن']);
});

test('ranking never treats public discovery as redistribution permission', () => {
  const ranked = rankSearchResults([{url:'https://example.org/a',sourceType:'official',redistributionAllowed:false,confidence:1},{url:'https://example.org/b',sourceType:'secondary',redistributionAllowed:true,confidence:.1}]);
  assert.equal(ranked[0].redistributionAllowed, true);
});
