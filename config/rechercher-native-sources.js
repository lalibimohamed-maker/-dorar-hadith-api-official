const q = (query) => ({ q: query });
const first = (value) => Array.isArray(value) ? value[0] : value;

export const NATIVE_SOURCES = Object.freeze([
  {
    id: 'internet-archive', name: 'Internet Archive', enabled: true, acquisition: 'pdf-when-permitted', rightsPolicy: 'source-declared',
    connector: {
      kind: 'rest-json', searchUrl: 'https://archive.org/advancedsearch.php', queryMap: (query) => ({ q: `title:(${query}) OR creator:(${query})`, output: 'json', rows: 50, page: 1 }),
      mapResults: (json) => (json?.response?.docs ?? []).map((d) => ({ identifier: d.identifier, title: d.title, author: first(d.creator), year: d.year, language: first(d.language), itemUrl: `https://archive.org/details/${d.identifier}`, pdfUrl: null, rightsUrl: `https://archive.org/details/${d.identifier}` })),
    },
  },
  {
    id: 'open-library', name: 'Open Library', enabled: true, acquisition: 'metadata-only', rightsPolicy: 'source-declared',
    connector: {
      kind: 'rest-json', searchUrl: 'https://openlibrary.org/search.json', queryMap: q,
      mapResults: (json) => (json?.docs ?? []).map((d) => ({ identifier: d.key, title: d.title, author: first(d.author_name), year: d.first_publish_year, language: first(d.language), itemUrl: `https://openlibrary.org${d.key}` })),
    },
  },
  {
    id: 'openiti', name: 'OpenITI / KITAB', enabled: true, acquisition: 'repository-text-and-metadata', rightsPolicy: 'repository-license',
    connector: {
      kind: 'rest-json', searchUrl: 'https://api.github.com/search/code', queryMap: (query) => ({ q: `${query} org:OpenITI`, per_page: 20 }),
      mapResults: (json) => (json?.items ?? []).map((d) => ({ identifier: d.html_url, title: d.name, itemUrl: d.html_url })),
    },
  },
  {
    id: 'wikimedia-commons', name: 'Wikimedia Commons', enabled: true, acquisition: 'media-when-permitted', rightsPolicy: 'commons-license',
    connector: {
      kind: 'rest-json', searchUrl: 'https://commons.wikimedia.org/w/api.php', queryMap: (query) => ({ action: 'query', generator: 'search', gsrsearch: query, gsrnamespace: 6, gsrlimit: 20, prop: 'imageinfo', iiprop: 'url|extmetadata', format: 'json', origin: '*' }),
      mapResults: (json) => Object.values(json?.query?.pages ?? {}).map((d) => ({ identifier: String(d.pageid), title: d.title, itemUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(d.title)}`, pdfUrl: d.imageinfo?.[0]?.url?.toLowerCase().endsWith('.pdf') ? d.imageinfo[0].url : null })),
    },
  },
  {
    id: 'library-of-congress', name: 'Library of Congress', enabled: true, acquisition: 'metadata-and-public-files', rightsPolicy: 'loc-rights',
    connector: {
      kind: 'rest-json', searchUrl: 'https://www.loc.gov/books/', queryMap: (query) => ({ q: query, fo: 'json', c: 20 }),
      mapResults: (json) => (json?.results ?? []).map((d) => ({ identifier: d.id, title: d.title, author: first(d.contributor), year: d.date, language: first(d.language), itemUrl: d.id })),
    },
  },
  {
    id: 'crossref', name: 'Crossref', enabled: true, acquisition: 'metadata-only', rightsPolicy: 'publisher-declared',
    connector: {
      kind: 'rest-json', searchUrl: 'https://api.crossref.org/works', queryMap: (query) => ({ query: query, rows: 20 }),
      mapResults: (json) => (json?.message?.items ?? []).map((d) => ({ identifier: d.DOI, title: first(d.title), author: d.author?.map((a) => `${a.given ?? ''} ${a.family ?? ''}`).join('; '), year: d.published?.['date-parts']?.[0]?.[0], itemUrl: d.URL })),
    },
  },
  {
    id: 'google-books', name: 'Google Books', enabled: true, acquisition: 'metadata-and-preview-when-permitted', rightsPolicy: 'google-books',
    connector: {
      kind: 'rest-json', searchUrl: 'https://www.googleapis.com/books/v1/volumes', queryMap: q,
      mapResults: (json) => (json?.items ?? []).map((d) => ({ identifier: d.id, title: d.volumeInfo?.title, author: first(d.volumeInfo?.authors), year: d.volumeInfo?.publishedDate, language: d.volumeInfo?.language, itemUrl: d.volumeInfo?.infoLink })),
    },
  },
  {
    id: 'smithsonian', name: 'Smithsonian', enabled: true, acquisition: 'metadata-and-public-media', rightsPolicy: 'smithsonian-declared',
    connector: {
      kind: 'rest-json', searchUrl: 'https://api.si.edu/openaccess/api/v1.0/search', queryMap: (query) => ({ q: query, api_key: 'DEMO_KEY', rows: 20 }),
      mapResults: (json) => (json?.response?.rows ?? []).map((d) => ({ identifier: d.id, title: d.title, itemUrl: d.content?.descriptiveNonRepeating?.record_link })),
    },
  },
  {
    id: 'gallica-bnf', name: 'Gallica / BnF', enabled: true, acquisition: 'oai-or-web-metadata', rightsPolicy: 'gallica-rights',
    connector: { kind: 'web-discovery', searchUrl: 'https://gallica.bnf.fr/services/engine/search/sru', queryMap: q, mapResults: () => [] },
  },
  {
    id: 'british-library-eap', name: 'British Library / EAP', enabled: true, acquisition: 'oai-or-web-metadata', rightsPolicy: 'bl-rights',
    connector: { kind: 'web-discovery', searchUrl: 'https://eap.bl.uk/', queryMap: q, mapResults: () => [] },
  },
  {
    id: 'princeton-pul', name: 'Princeton PUL', enabled: true, acquisition: 'iiif-or-web-metadata', rightsPolicy: 'pul-rights',
    connector: { kind: 'web-discovery', searchUrl: 'https://dpul.princeton.edu/', queryMap: q, mapResults: () => [] },
  },
  {
    id: 'bodleian', name: 'Bodleian Libraries', enabled: true, acquisition: 'iiif-or-web-metadata', rightsPolicy: 'bodleian-rights',
    connector: { kind: 'web-discovery', searchUrl: 'https://digital.bodleian.ox.ac.uk/', queryMap: q, mapResults: () => [] },
  },
  {
    id: 'cambridge-digital', name: 'Cambridge Digital Library', enabled: true, acquisition: 'iiif-or-web-metadata', rightsPolicy: 'cambridge-rights',
    connector: { kind: 'web-discovery', searchUrl: 'https://cudl.lib.cam.ac.uk/', queryMap: q, mapResults: () => [] },
  },
  {
    id: 'vatican-library', name: 'Vatican Library', enabled: true, acquisition: 'iiif-or-web-metadata', rightsPolicy: 'vatican-rights',
    connector: { kind: 'web-discovery', searchUrl: 'https://digi.vatlib.it/', queryMap: q, mapResults: () => [] },
  },
  {
    id: 'qatar-digital-library', name: 'Qatar Digital Library', enabled: true, acquisition: 'iiif-or-web-metadata', rightsPolicy: 'qdl-rights',
    connector: { kind: 'web-discovery', searchUrl: 'https://www.qdl.qa/', queryMap: q, mapResults: () => [] },
  },
  {
    id: 'nyu-aco', name: 'NYU Arabic Collections Online', enabled: true, acquisition: 'iiif-or-web-metadata', rightsPolicy: 'aco-rights',
    connector: { kind: 'web-discovery', searchUrl: 'https://aco.dlib.nyu.edu/', queryMap: q, mapResults: () => [] },
  },
  {
    id: 'al-furqan', name: 'Al-Furqan Islamic Heritage Foundation', enabled: true, acquisition: 'web-discovery', rightsPolicy: 'institution-declared',
    connector: { kind: 'web-discovery', searchUrl: 'https://al-furqan.com/', queryMap: q, mapResults: () => [] },
  },
  {
    id: 'waqfeya', name: 'Waqfeya', enabled: true, acquisition: 'web-discovery-and-pdf-when-permitted', rightsPolicy: 'source-declared',
    connector: { kind: 'web-discovery', searchUrl: 'https://waqfeya.net/', queryMap: q, mapResults: () => [] },
  },
  {
    id: 'shamela', name: 'Al-Maktaba Al-Shamela', enabled: true, acquisition: 'web-discovery', rightsPolicy: 'source-declared',
    connector: { kind: 'web-discovery', searchUrl: 'https://shamela.ws/', queryMap: q, mapResults: () => [] },
  },
  {
    id: 'oai-generic', name: 'Generic OAI-PMH', enabled: false, acquisition: 'metadata-only', rightsPolicy: 'unknown-blocked',
    connector: { kind: 'oai-pmh', endpoint: 'https://example.org/oai', queryMap: q, mapResults: () => [] },
  },
]);
