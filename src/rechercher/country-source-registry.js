import { RECHERCHER_COUNTRY_SOURCE_REGISTRIES, flattenCountrySources } from '../../config/rechercher-country-source-registries.js';

/**
 * Adapt country registry entries into the same immutable source shape used by
 * the native federation layer.  Entries remain web-discovery until a native
 * REST/OAI/IIIF/SRU interface is verified for that institution.
 */
export function countrySources(countryCode) {
  const country = RECHERCHER_COUNTRY_SOURCE_REGISTRIES[countryCode];
  if (!country) return [];
  return country.sources.map(toFederationSource);
}

export function allCountrySources() {
  return flattenCountrySources().map(toFederationSource);
}

export function toFederationSource(entry) {
  return {
    id: entry.id,
    name: entry.name,
    enabled: entry.enabled,
    country: entry.country,
    sourceKind: entry.kind,
    acquisition: entry.acquisition,
    rightsPolicy: entry.rights_policy,
    connector: {
      kind: entry.native_protocol === 'web-discovery' ? 'web-discovery' : entry.native_protocol,
      searchUrl: entry.url,
      queryMap: (query) => ({ q: query }),
      mapResults: () => [],
    },
  };
}
