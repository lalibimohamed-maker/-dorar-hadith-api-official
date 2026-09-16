/**
 * Rechercher — Global multilingual Islamic source federation v2.
 *
 * Discovery-only registry: a source may expose a native API only when its
 * interface is explicitly documented/verified. Discovery never grants PDF or
 * redistribution rights. Rights are kept as metadata for downstream policy.
 */

const source = ({ id, name, domains, languages, content, access = {}, api = null, rights = {} }) => ({
  id,
  name,
  domains,
  languages,
  content,
  access,
  api,
  rights,
  discoveryOnly: true,
});

export default [
  source({
    id: 'quranpedia-api',
    name: 'Quranpedia API',
    domains: ['quranpedia.net', 'api.quranpedia.net'],
    languages: ['ar', 'en', 'fr', 'es', 'tr', 'ur', 'id', 'ru', 'de', 'fa', 'bn'],
    content: ['quran', 'mushafs', 'translations', 'tafsir', 'i3rab', 'asbab-al-nuzul', 'fatwas', 'topics', 'qiraat', 'books', 'recitations', 'search'],
    access: { mode: 'rest-json', authentication: 'none', rateLimit: '120/min,10000/day', bulk: 'official-dumps' },
    api: {
      baseUrl: 'https://api.quranpedia.net/v1',
      documented: true,
      endpoints: [
        '/mushafs', '/mushafs/{mushaf_id}/{surah_id}/{ayah_number?}',
        '/surah/information/{surah}', '/ayah/{surah}/{ayah}/{service}',
        '/translations/{surah}/{ayah}/{language?}', '/translation-books/{language_code?}',
        '/translation/{book_id}/{surah}/{ayah_number?}', '/tafsir', '/books', '/fatwas',
        '/topics', '/reciters', '/search/{query}/{type}', '/changes?since={date}',
      ],
      sync: 'changes-endpoint',
      dumps: true,
    },
    rights: { discovery: true, liveApi: true, republish: 'see-source-policy', bulkMirror: 'official-dumps-only' },
  }),
  source({
    id: 'islamhouse-api',
    name: 'IslamHouse API',
    domains: ['islamhouse.com', 'api2.islamhouse.com', 'api.islamhouse.com'],
    languages: '147-language-directory',
    content: ['quran', 'hadith', 'books', 'articles', 'fatwas', 'audio', 'video', 'authors', 'publishers', 'attachments'],
    access: { mode: 'rest-json', authentication: 'api-key-or-published-client-token', pagination: true },
    api: {
      baseUrl: 'https://api2.islamhouse.com/v1',
      documented: true,
      multilingual: true,
      endpoints: [
        '/quran/get-available-languages/json',
        '/quran/get-category/{id}/{language}/json',
      ],
      availableLanguagesEndpoint: '/quran/get-available-languages/json',
      quranCategories: '/quran/get-category/{id}/{language}/json',
    },
    rights: { discovery: true, liveApi: true, republish: 'source-policy', preserveOriginalText: true, attribution: true },
  }),
  source({
    id: 'quranenc-api',
    name: 'QuranEnc',
    domains: ['quranenc.com'],
    languages: 'multilingual',
    content: ['quran-translations', 'tafsir', 'surah', 'ayah'],
    access: { mode: 'rest-json', authentication: 'none-or-public-endpoints' },
    api: {
      baseUrl: 'https://quranenc.com/api/v1',
      documented: true,
      multilingual: true,
      endpoints: [
        '/translations/list/[[{language}]]/?localization={language_iso_code}',
        '/translation/sura/{translation_key}/{sura_number}',
        '/translation/aya/{translation_key}/{sura_number}/{aya_number}',
        '/translations/note',
      ],
      staticAudioBaseUrl: 'https://d.quranenc.com/data/audio/{translation_key}/{sura_3digits}{aya_3digits}.mp3',
      formats: ['json', 'xml', 'csv', 'xls'],
    },
    rights: { discovery: true, liveApi: true, republish: 'source-policy', preserveOriginalText: true, attribution: true },
  }),
  source({
    id: 'hadeethenc-api',
    name: 'HadeethEnc',
    domains: ['hadeethenc.com'],
    languages: 'published-languages',
    content: ['hadith', 'translations', 'explanations', 'categories'],
    access: { mode: 'rest-json', authentication: 'none', pagination: true },
    api: {
      baseUrl: 'https://hadeethenc.com/api/v1',
      documented: true,
      endpoints: [
        '/languages', '/categories/list/?language={language}', '/categories/roots/?language={language}',
        '/hadeeths/list/?language={language}&category_id={categoryId}&page={page}&per_page={perPage}',
        '/hadeeths/one/?id={id}&language={language}',
      ],
      deepDiscovery: true,
    },
    rights: { discovery: true, liveApi: true, preserveOriginalText: true, attribution: true },
  }),
  source({
    id: 'islamenc',
    name: 'Islamic Encyclopedia (IslamEnc)',
    domains: ['islamenc.com', 's.islamenc.com'],
    languages: '100-plus-languages',
    content: ['quran', 'quran-translations', 'tafsir', 'hadith', 'hadith-encyclopedias', 'verified-books', 'islamic-content'],
    access: { mode: 'web-discovery', apiClaimedBySource: true, apiVerification: 'pending-primary-documentation' },
    rights: { discovery: true, verifyBeforeAcquisition: true },
  }),
  source({
    id: 'terminologyenc',
    name: 'Terminology Encyclopedia',
    domains: ['terminologyenc.com'],
    languages: ['ar', 'en', 'fr', 'es', 'ur', 'id', 'ru', 'tr', 'pt', 'bn', 'zh', 'fa', 'tl', 'hi', 'ml', 'te', 'th'],
    content: ['islamic-terminology', 'definitions', 'translations', 'fiqh-terms', 'aqidah-terms', 'references'],
    access: { mode: 'web-discovery', multilingual: true },
    rights: { discovery: true, verifyBeforeAcquisition: true },
  }),
  source({ id: 'islamic-content', name: 'Islamic Content', domains: ['islamic-content.com'], languages: 'multilingual', content: ['books', 'articles', 'quran', 'hadith', 'fatwas', 'media'], access: { mode: 'web-discovery' }, rights: { discovery: true, verifyBeforeAcquisition: true } }),
  source({ id: 'islamqa-multilingual', name: 'IslamQA multilingual', domains: ['islamqa.info'], languages: ['ar', 'en', 'fr', 'ru', 'tr', 'ur', 'id', 'es', 'de', 'bn'], content: ['fatwas', 'quran', 'hadith', 'aqidah', 'fiqh'], access: { mode: 'web-discovery' }, rights: { discovery: true, verifyBeforeAcquisition: true } }),
  source({ id: 'alukah', name: 'Alukah', domains: ['alukah.net'], languages: ['ar'], content: ['books', 'articles', 'quran', 'hadith', 'fiqh', 'aqidah', 'history'], access: { mode: 'web-discovery' }, rights: { discovery: true, verifyBeforeAcquisition: true } }),
  source({ id: 'ketabonline', name: 'KetabOnline', domains: ['ketabonline.com'], languages: ['ar'], content: ['books'], access: { mode: 'web-discovery' }, rights: { discovery: true, verifyBeforeAcquisition: true } }),
  source({ id: 'islamplus', name: 'Islam.plus', domains: ['islam.plus'], languages: ['ru', 'ar', 'en'], content: ['quran', 'hadith', 'articles', 'fatwas'], access: { mode: 'web-discovery' }, rights: { discovery: true, verifyBeforeAcquisition: true } }),
  source({ id: 'islamdag', name: 'IslamDag', domains: ['islamdag.ru'], languages: ['ru'], content: ['quran', 'hadith', 'fiqh', 'articles', 'audio'], access: { mode: 'web-discovery' }, rights: { discovery: true, verifyBeforeAcquisition: true } }),
  source({ id: 'azbyka', name: 'Azbyka', domains: ['azbyka.ru'], languages: ['ru'], content: ['comparative-religion', 'islam-reference'], access: { mode: 'web-discovery' }, rights: { discovery: true, verifyBeforeAcquisition: true } }),
  source({ id: 'muslim-library', name: 'Muslim Library', domains: ['muslim-library.com'], languages: 'multilingual', content: ['books', 'articles'], access: { mode: 'web-discovery' }, rights: { discovery: true, verifyBeforeAcquisition: true } }),
  source({ id: 'islamicbulletin', name: 'Islamic Bulletin', domains: ['islamicbulletin.org'], languages: ['en', 'es'], content: ['quran', 'hadith', 'books', 'articles', 'education'], access: { mode: 'web-discovery' }, rights: { discovery: true, verifyBeforeAcquisition: true } }),
  source({ id: 'whyislam', name: 'WhyIslam', domains: ['whyislam.org'], languages: ['en', 'es'], content: ['quran', 'articles', 'books', 'education'], access: { mode: 'web-discovery' }, rights: { discovery: true, verifyBeforeAcquisition: true } }),
  source({ id: 'osoulstore', name: 'Osoul Store', domains: ['osoulstore.com'], languages: 'multilingual', content: ['books'], access: { mode: 'web-discovery' }, rights: { discovery: true, verifyBeforeAcquisition: true } }),
  source({ id: 'islamreligion', name: 'The Religion of Islam', domains: ['islamreligion.com'], languages: 'multilingual', content: ['articles', 'quran', 'hadith', 'history'], access: { mode: 'web-discovery' }, rights: { discovery: true, verifyBeforeAcquisition: true } }),
  source({ id: 'byenah', name: 'Baynah', domains: ['byenah.com'], languages: 'multilingual', content: ['quran', 'hadith', 'articles', 'education'], access: { mode: 'web-discovery' }, rights: { discovery: true, verifyBeforeAcquisition: true } }),
  source({ id: 'daura', name: 'Daura', domains: ['daura.com'], languages: 'multilingual', content: ['courses', 'lectures', 'books', 'articles'], access: { mode: 'web-discovery' }, rights: { discovery: true, verifyBeforeAcquisition: true } }),
];
