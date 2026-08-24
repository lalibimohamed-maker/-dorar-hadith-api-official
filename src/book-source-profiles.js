/**
 * Source profiles describe where discovery may occur and what the connector is
 * allowed to claim. A profile is not a copyright grant and does not authorize
 * scraping, mirroring, or redistribution.
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
]);

export function getBookSourceProfile(id) {
  return BOOK_SOURCE_PROFILES.find((profile) => profile.id === id) ?? null;
}
