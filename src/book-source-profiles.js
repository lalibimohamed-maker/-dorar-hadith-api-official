/**
 * Source profiles describe where discovery may occur and what the connector is
 * allowed to claim. A profile is not a copyright grant and does not authorize
 * scraping, mirroring, or redistribution.
 *
 * Official government sources are first-class discovery sources. Their official
 * status improves provenance, but never by itself grants redistribution rights.
 */

export const BOOK_SOURCE_PROFILES = Object.freeze([
  Object.freeze({
    id: 'shamela',
    name: 'المكتبة الشاملة',
    homepage: 'https://shamela.ws/',
    capabilities: ['metadata', 'reader-link'],
    defaultRights: 'rights-unclear',
  }),
  Object.freeze({
    id: 'waqfeya',
    name: 'المكتبة الوقفية',
    homepage: 'https://waqfeya.net/',
    capabilities: ['metadata', 'reader-link'],
    defaultRights: 'rights-unclear',
  }),
  Object.freeze({
    id: 'noor-book',
    name: 'مكتبة نور',
    homepage: 'https://www.noor-book.com/',
    capabilities: ['metadata', 'reader-link'],
    defaultRights: 'rights-unclear',
  }),
  Object.freeze({
    id: 'qatar-awqaf-ebooks',
    name: 'وزارة الأوقاف والشؤون الإسلامية - دولة قطر',
    homepage: 'https://www.islam.gov.qa/ebooks/',
    capabilities: ['official', 'metadata', 'reader-link'],
    defaultRights: 'rights-unclear',
  }),
  Object.freeze({
    id: 'qatar-quran',
    name: 'قسم القرآن الكريم وعلومه - وزارة الأوقاف القطرية',
    homepage: 'https://alquran.islam.gov.qa/',
    capabilities: ['official', 'quran', 'metadata', 'reader-link'],
    defaultRights: 'rights-unclear',
  }),
  Object.freeze({
    id: 'kuwait-awqaf',
    name: 'وزارة الأوقاف والشؤون الإسلامية - دولة الكويت',
    homepage: 'https://www.awqaf.gov.kw/',
    capabilities: ['official', 'metadata', 'reader-link'],
    defaultRights: 'rights-unclear',
  }),
  Object.freeze({
    id: 'kuwait-awqaf-books',
    name: 'إصدارات وزارة الأوقاف والشؤون الإسلامية - الكويت',
    homepage: 'https://www.awqaf.gov.kw/ar/إصدارات%20الوزارة',
    capabilities: ['official', 'metadata', 'reader-link'],
    defaultRights: 'rights-unclear',
  }),
  Object.freeze({
    id: 'saudi-moia',
    name: 'وزارة الشؤون الإسلامية والدعوة والإرشاد - السعودية',
    homepage: 'https://www.moia.gov.sa/',
    capabilities: ['official', 'metadata', 'reader-link'],
    defaultRights: 'rights-unclear',
  }),
  Object.freeze({
    id: 'saudi-islamic-library',
    name: 'المكتبة الإلكترونية الإسلامية - وزارة الشؤون الإسلامية السعودية',
    homepage: 'https://ebook.moia.gov.sa/',
    capabilities: ['official', 'metadata', 'reader-link', 'audio'],
    defaultRights: 'rights-unclear',
  }),
]);

export function getBookSourceProfile(id) {
  return BOOK_SOURCE_PROFILES.find((profile) => profile.id === id) ?? null;
}
