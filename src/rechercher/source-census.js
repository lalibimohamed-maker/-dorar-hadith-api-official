import { NATIVE_SOURCES } from '../../config/rechercher-native-sources.js';
import { RECHERCHER_COUNTRY_SOURCE_REGISTRIES } from '../../config/rechercher-country-source-registries.js';
import { allCountrySources } from './country-source-registry.js';

export const ARAB_COUNTRY_CODES = Object.freeze(Object.keys(RECHERCHER_COUNTRY_SOURCE_REGISTRIES));

export function buildSourceCensus() {
  const countrySources = allCountrySources();
  const all = [...NATIVE_SOURCES.map((source) => ({ ...source, registry: 'global' })), ...countrySources.map((source) => ({ ...source, registry: 'country' }))];
  const ids = new Set();
  const duplicateIds = [];
  for (const source of all) {
    if (ids.has(source.id)) duplicateIds.push(source.id);
    ids.add(source.id);
  }
  const byCountry = Object.fromEntries(ARAB_COUNTRY_CODES.map((code) => [code, 0]));
  for (const source of countrySources) byCountry[source.country] = (byCountry[source.country] ?? 0) + 1;
  const nativeProtocols = {};
  for (const source of all) {
    const protocol = source.connector?.kind ?? 'unknown';
    nativeProtocols[protocol] = (nativeProtocols[protocol] ?? 0) + 1;
  }
  return {
    schema: 'din-allah-encyclopedia/rechercher-source-census/v1',
    generatedAt: new Date().toISOString(),
    globalSourceCount: NATIVE_SOURCES.length,
    countrySourceCount: countrySources.length,
    totalSourceCount: all.length,
    arabCountryCount: ARAB_COUNTRY_CODES.length,
    arabCountryCodes: ARAB_COUNTRY_CODES,
    byCountry,
    nativeProtocols,
    duplicateIds,
    verifiedNativeProtocolPolicy: 'Only explicitly verified native interfaces may be declared REST/OAI-PMH/IIIF/SRU; unverified institutions remain web-discovery.',
    corpusIsolation: 'source-registry-only; never writes Corpus content',
  };
}

export function assertSourceCensus(census = buildSourceCensus()) {
  if (census.arabCountryCount !== 22) throw new Error(`Expected 22 Arab country registries, got ${census.arabCountryCount}`);
  if (census.byCountry.SA < 20) throw new Error(`Saudi source registry unexpectedly small: ${census.byCountry.SA}`);
  if (census.duplicateIds.length) throw new Error(`Duplicate source IDs: ${census.duplicateIds.join(', ')}`);
  return census;
}
