/**
 * Rechercher — deep contracts for IslamContent + TerminologyEnc.
 *
 * These are additive. Discovery is source-aware and rights-aware; discovery
 * never grants acquisition or redistribution permission.
 */

export const DEEP_SOURCES = [
  {
    id: 'islamcontent-deep',
    sourceId: 'islamcontent-api',
    kind: 'documented-api-plus-web-discovery',
    documentationUrl: 'https://islamcontent.com/en/developers_api',
    postmanCollectionUrl: 'https://islamcontent.com/download-request?name=iscontent.postman_collection.json',
    postmanEnvironmentUrl: 'https://islamcontent.com/download-request?name=iscontent+env.postman_environment.json',
    languages: '130-language-directory',
    web: {
      baseUrl: 'https://islamcontent.com',
      routes: ['/{lang}/categories','/{lang}/content','/{lang}/content/{id}','/{lang}/single-content/{id}','/{lang}/categories?content_type={type}&lang={lang}','/{lang}/content?content_type={type}&lang={lang}&page={page}','/{lang}/content?subject_category={subject_category}&lang={lang}'],
      contentTypes: ['khotab','books','applications','audios','articles','videos','fatwa','posters','cards','quran','favorites','news','programsv'],
      serviceLinks: ['quranenc','hadeethenc','bayan-al-islam','kids-islamenc','translated-islamic-content','qa-islam','mofeed','terminologyenc','saadi'],
      attachmentDiscovery: true, multilingualDiscovery: true, pagination: true, sourceCatalog: true,
    },
    api: {
      status: 'documented-pending-live-verification',
      collectionCompleteness: 'use-current-official-postman-download; do-not-assume-legacy-host-is-live',
      legacyEndpointEvidence: ['GET /Api/categories?lang={lang}','GET /Api/content?lang={lang}','GET /Api/content?lang={lang}&name={name}&subject_category={subject_category}&author={author}&sort_by={sort_by}','GET /Api/languages','GET /Api/authors?lang={lang}&name={name}','GET /Api/single-content?id={id}'],
      liveProbeRequired: true,
    },
    rights: { discovery: true, acquisition: 'verify-per-item-rights', redistribution: 'publisher-policy-only' },
  },
  {
    id: 'terminologyenc-deep',
    sourceId: 'terminologyenc',
    kind: 'structured-knowledge-source',
    baseUrl: 'https://terminologyenc.com',
    languages: ['en','ar','fr','es','tr','ur','id','bs','ru','zh'],
    apiDiscoveryStatus: 'actively-seeking',
    graph: {
      enabled: true,
      schema: 'deen-allah-unified-knowledge-graph/v1',
      entities: ['language','category','subcategory','term','translation','dictionary','reference'],
      relations: ['supports_language','has_category','has_subcategory','has_term','translated_as','has_dictionary','has_reference','same_concept_as','discovered_from'],
      provenanceRequired: true,
      sourceTextPreservation: true,
      apiAgnostic: true,
    },
    web: {
      homeRoutes: ['/en/home','/ar/home','/fr/home'],
      categoryRoute: '/{lang}/browse/category/{categoryId}',
      termRoute: '/{lang}/browse/term/{termId}',
      categoryDiscovery: true,
      subcategoryDiscovery: true,
      termDiscovery: true,
      translationMatrixDiscovery: true,
      searchUi: true,
      dictionaries: ['beautiful-names-of-allah','sects-and-religions','places','persons'],
      mainCategories: ['quran-and-quranic-sciences','hadith-and-hadith-sciences','creed','jurisprudence-and-juristic-principles','virtues-and-manners','dawah-and-hisbah','seerah-and-history','other'],
    },
    api: {
      status: 'actively-seeking',
      endpoints: [],
      policy: 'continue-searching-for-publisher-declared-api; never invent-or-promote-guessed-endpoints',
      promotionRule: 'promote-to-native-connector-only-after-first-party-endpoint-verification',
    },
    rights: { discovery: true, acquisition: 'verify-per-item-rights', redistribution: 'publisher-policy-only' },
  },
];

export default DEEP_SOURCES;
