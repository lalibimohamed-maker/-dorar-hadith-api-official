import test from 'node:test';
import assert from 'node:assert/strict';
import { governedAlternativeDiscovery } from '../src/rechercher-alternative-discovery.js';

function fetchFactory(license = true) {
  return async input => {
    const url = String(input);
    if (url.includes('advancedsearch.php')) return { ok: true, async json() { return { response: { docs: [{ identifier: 'candidate', title: 'كتاب التفسير', creator: ['مؤلف'], license: license ? 'CC BY 4.0' : undefined, rights: license ? 'Creative Commons Attribution' : 'All rights reserved' }] } }; } };
    if (url.includes('/metadata/candidate')) return { ok: true, async json() { return { files: [{ name: 'candidate.pdf', private: false }] }; } };
    throw new Error(`unexpected URL: ${url}`);
  };
}

test('governed discovery returns a downloadable alternative only after rights verification', async () => {
  const result = await governedAlternativeDiscovery({ title: 'كتاب التفسير', author: 'مؤلف' }, {
    fetchImpl: fetchFactory(true),
    verify: true,
    inspectImpl: async () => ({ metadata: { title: 'كتاب التفسير', author: 'مؤلف', rights: 'Creative Commons Attribution 4.0', rightsSignals: [{ kind: 'explicit-redistribution-permission', excerpt: 'Creative Commons' }] } })
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].rightsVerified, true);
  assert.equal(result[0].downloadUrl, 'https://archive.org/download/candidate/candidate.pdf');
});

test('governed discovery excludes an alternative with reserved rights', async () => {
  const result = await governedAlternativeDiscovery({ title: 'كتاب التفسير', author: 'مؤلف' }, {
    fetchImpl: fetchFactory(false),
    verify: true,
    inspectImpl: async () => ({ metadata: { title: 'كتاب التفسير', author: 'مؤلف', rights: 'All rights reserved', rightsSignals: [{ kind: 'copyright-reservation', excerpt: 'All rights reserved' }] } })
  });
  assert.deepEqual(result, []);
});
