import { RECHERCHER_COUNTRY_SOURCE_REGISTRIES, flattenCountrySources } from '../../config/rechercher-country-source-registries.js';

/**
 * Adapt country registry entries into the immutable source shape used by the
 * federation layer. Country entries remain web-discovery unless the protocol
 * is explicitly present in this verified allow-list. Merely calling something
 * a repository/digital-library is not evidence of a machine-readable native
 * endpoint.
 */
const VERIFIED_NATIVE_PROTOCOLS = new Set(['rest-json', 'oai-pmh', 'iiif', 'sru']);

export function countrySources(countryCode) {
  const country = RECHERCHER_COUNTRY_SOURCE_REGISTRIES[countryCode];
  if (!country) return [];
  return country.sources.map(toFederationSource);
}

export function allCountrySources() {
  return flattenCountrySources().map(toFederationSource);
}

export function toFederationSource(entry) {
  const declared = entry.native_protocol;
  const kind = VERIFIED_NATIVE_PROTOCOLS.has(declared) ? declared : 'web-discovery';
  return {
    id: entry.id,
    name: entry.name,
    enabled: entry.enabled,
    country: entry.country,
    sourceKind: entry.kind,
    acquisition: entry.acquisition,
    rightsPolicy: entry.rights_policy,
    connector: {
      kind,
      searchUrl: entry.url,
      queryMap: (query) => ({ q: query }),
      mapResults: () => [],
    },
  };
}

export function isVerifiedNativeProtocol(protocol) {
  return VERIFIED_NATIVE_PROTOCOLS.has(protocol);
}
