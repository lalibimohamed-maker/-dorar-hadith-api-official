export const GLOBAL_MULTILINGUAL_PRIORITY = Object.freeze([
  { id: 'terminology-enc', url: 'https://terminologyenc.com/fr/home', languages: 'world', role: 'multilingual Islamic terminology', connector: 'web-discovery' },
  { id: 'alquran-islam-gov-qa', url: 'https://alquran.islam.gov.qa/', languages: 'Arabic/multilingual reference', role: 'Quran reference', connector: 'web-discovery' },
  { id: 'islamic-content-jamharah', url: 'https://islamic-content.com/', languages: 'multilingual', role: 'Islamic content encyclopedia', connector: 'web-discovery' },
  { id: 'islamhouse', url: 'https://islamhouse.com/', languages: '132+', role: 'books/articles/audio/video/PDF discovery', connector: 'rest-json-verified-with-key' },
  { id: 'islamhouse-d1-assets', url: 'https://d1.islamhouse.com/', languages: 'multilingual', role: 'IslamHouse asset discovery', connector: 'web-discovery' },
  { id: 'islamqa', url: 'https://islamqa.info/ar', languages: 'multilingual', role: 'Q&A/reference', connector: 'web-discovery' },
  { id: 'islamreligion', url: 'https://www.islamreligion.com/', languages: 'multilingual', role: 'Islamic reference', connector: 'web-discovery' },
  { id: 'byenah', url: 'https://byenah.com/', languages: 'multilingual', role: 'Islamic education/reference', connector: 'web-discovery' },
  { id: 'muslim-library', url: 'https://www.muslim-library.com/', languages: 'multilingual', role: 'digital library/PDF discovery', connector: 'web-discovery' },
  { id: 'islamic-bulletin', url: 'https://islamicbulletin.org/', languages: 'multilingual', role: 'articles/books/media discovery', connector: 'web-discovery' },
  { id: 'whyislam', url: 'https://www.whyislam.org/', languages: 'multilingual', role: 'Islamic education/reference', connector: 'web-discovery' },
  { id: 'osoulstore', url: 'https://osoulstore.com/', languages: 'multilingual', role: 'books/PDF/audio/interactive discovery', connector: 'web-discovery' },
  { id: 'alukah', url: 'https://www.alukah.net/', languages: 'multilingual', role: 'articles/books/reference', connector: 'web-discovery' },
  { id: 'ketabonline', url: 'https://ketabonline.com/ar', languages: 'multilingual', role: 'large book discovery/search', connector: 'web-discovery' },
  { id: 'azbyka', url: 'https://azbyka.ru/', languages: 'Russian', role: 'broad religious discovery', connector: 'web-discovery' },
  { id: 'islam-plus-ru', url: 'https://islam.plus/ru', languages: 'Russian', role: 'Islamic reference', connector: 'web-discovery' },
  { id: 'islamdag-ru', url: 'https://islamdag.ru/', languages: 'Russian', role: 'Islamic reference', connector: 'web-discovery' },
  { id: 'daura', url: 'https://daura.com/', languages: 'multilingual', role: 'Islamic educational discovery', connector: 'web-discovery' },
  { id: 'islamenc', url: 'https://s.islamenc.com/lang/en', languages: '50+', role: 'Quran/Hadith/Islamic encyclopedias and APIs', connector: 'web-discovery-until-api-verification' }
]);

export const GLOBAL_MULTILINGUAL_POLICY = Object.freeze({
  schema: 'din-allah-encyclopedia/rechercher-global-multilingual-priority/v1',
  corpusIsolation: true,
  rightsRequiredForAcquisition: true,
  nativePromotionRequiresDocumentedInterface: true,
  sourceDiscoveryNeverImpliesRedistribution: true
});
