import test from 'node:test';
import assert from 'node:assert/strict';
import { globalSearchAnalysts, GLOBAL_OUTCOMES, GLOBAL_PROVIDERS } from '../src/rechercher-global-search.js';

test('global analysts query public providers and select only a rights-cleared downloadable candidate', async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    const u = String(url);
    requested.push(u);
    if (u.includes('archive.org/advancedsearch.php')) {
      return { ok: true, async json() { return { response: { docs: [{ identifier: 'ia-open', title: 'كتاب في التفسير', creator: ['مؤلف'], rights: 'Creative Commons', license: 'CC BY 4.0' }] } }; } };
    }
    if (u.includes('openlibrary.org/search.json')) {
      return { ok: true, async json() { return { docs: [{ key: '/books/OL1M', title: 'كتاب في التفسير', author_name: ['مؤلف'], ebook_access: 'public', edition_key: ['OL1M'] }] }; } };
    }
    if (u.includes('googleapis.com/books/v1/volumes')) {
      return { ok: true, async json() { return { items: [{ id: 'gb1', volumeInfo: { title: 'كتاب في التفسير', authors: ['مؤلف'] }, accessInfo: { publicDomain: true, pdf: { isAvailable: true }, webReaderLink: 'https://books.google.com/books?id=gb1' } }] }; } };
    }
    if (u.includes('archive.org/details/ia-open')) {
      return { ok: true, async text() { return '<html><head><title>كتاب في التفسير</title><meta name="author" content="مؤلف"><meta name="rights" content="Creative Commons"><meta name="license" content="CC BY 4.0"></head><body>Creative Commons free to redistribute</body></html>'; } };
    }
    if (u.includes('archive.org/metadata/ia-open')) {
      return { ok: true, async json() { return { files: [{ name: 'book.pdf', private: false }] }; } };
    }
    if (u.includes('gallica.bnf.fr/SRU')) return { ok: true, async text() { return '<searchRetrieveResponse></searchRetrieveResponse>'; } };
    return { ok: true, async json() { return { docs: [], response: { docs: [] }, items: [], records: [] }; } };
  };

  const result = await globalSearchAnalysts({ title: 'كتاب في التفسير', author: 'مؤلف', rightsDecision: 'read-only' }, {
    fetchImpl,
    europeanaKey: '',
    dplaKey: '',
    worldcatKey: '',
    worldcatEndpoint: ''
  });

  assert.equal(result.outcome, GLOBAL_OUTCOMES.ALTERNATIVE_FOUND);
  assert.ok(result.selected);
  assert.equal(result.selected.provider, GLOBAL_PROVIDERS.INTERNET_ARCHIVE);
  assert.equal(result.selected.rightsVerified, true);
  assert.equal(result.selected.downloadVerified, true);
  assert.ok(requested.some(url => url.includes('openlibrary.org/search.json')));
  assert.ok(requested.some(url => url.includes('googleapis.com/books/v1/volumes')));
  assert.ok(result.providerStatus.some(x => x.provider === GLOBAL_PROVIDERS.EUROPEANA && x.status === 'needs-credentials'));
});

test('global analysts never turn an unproven public listing into an eligible download', async () => {
  const fetchImpl = async (url) => {
    const u = String(url);
    if (u.includes('archive.org/advancedsearch.php')) return { ok: true, async json() { return { response: { docs: [{ identifier: 'unknown', title: 'كتاب في التفسير', creator: ['مؤلف'], rights: 'unknown' }] } }; } };
    if (u.includes('archive.org/details/unknown')) return { ok: true, async text() { return '<html><title>كتاب في التفسير</title><body>all rights reserved</body></html>'; } };
    if (u.includes('archive.org/metadata/unknown')) return { ok: true, async json() { return { files: [{ name: 'book.pdf', private: false }] }; } };
    if (u.includes('openlibrary.org/search.json')) return { ok: true, async json() { return { docs: [] }; } };
    if (u.includes('googleapis.com/books/v1/volumes')) return { ok: true, async json() { return { items: [] }; } };
    if (u.includes('gallica.bnf.fr/SRU')) return { ok: true, async text() { return '<response></response>'; } };
    return { ok: true, async json() { return { items: [] }; } };
  };

  const result = await globalSearchAnalysts({ title: 'كتاب في التفسير', author: 'مؤلف' }, { fetchImpl, europeanaKey: '', dplaKey: '', worldcatKey: '', worldcatEndpoint: '' });
  assert.equal(result.selected, null);
  assert.equal(result.outcome, GLOBAL_OUTCOMES.READ_ONLY_ORIGINAL);
});
