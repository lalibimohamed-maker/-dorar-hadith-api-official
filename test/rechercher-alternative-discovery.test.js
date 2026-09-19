import test from 'node:test';
import assert from 'node:assert/strict';
import { governedAlternativeDiscovery } from '../src/rechercher-alternative-discovery.js';

test('alternative discovery queries Internet Archive and keeps rights uncleared until verified', async () => {
  let requested = null;
  const result = await governedAlternativeDiscovery({
    title: 'كتاب في التفسير',
    author: 'مؤلف'
  }, {
    fetchImpl: async url => {
      requested = String(url);
      return {
        ok: true,
        async json() {
          return { response: { docs: [
            {
              identifier: 'open-item',
              title: 'كتاب في التفسير',
              creator: ['مؤلف'],
              license: 'https://creativecommons.org/licenses/by/4.0/',
              rights: 'Creative Commons'
            },
            {
              identifier: 'weak-item',
              title: 'كتاب آخر',
              creator: ['آخر'],
              rights: 'unknown'
            }
          ] } };
        }
      };
    }
  });

  assert.match(requested, /archive\.org\/advancedsearch\.php/);
  assert.equal(result.length, 1);
  assert.equal(result[0].sourceUrl, 'https://archive.org/details/open-item');
  assert.equal(result[0].rightsVerified, false);
  assert.equal(result[0].rightsDecision, 'unclear');
});
