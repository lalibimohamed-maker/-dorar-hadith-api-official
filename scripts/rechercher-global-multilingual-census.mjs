import registry from '../config/rechercher-global-multilingual-sources-v2.js';

const flatten = (value) => Array.isArray(value) ? value : (value == null ? [] : [value]);

const languages = new Set();
const apiSources = [];
const discoverySources = [];
const contentTypes = new Set();

for (const item of registry) {
  for (const language of flatten(item.languages)) languages.add(language);
  for (const type of flatten(item.content)) contentTypes.add(type);
  if (item.api?.documented) apiSources.push({ id: item.id, baseUrl: item.api.baseUrl ?? null, endpoints: item.api.endpoints ?? [] });
  else discoverySources.push(item.id);
}

const result = {
  generatedAt: new Date().toISOString(),
  registry: 'global-multilingual-v2',
  sourceCount: registry.length,
  nativeApiSourceCount: apiSources.length,
  discoveryOnlySourceCount: discoverySources.length,
  languageDirectoryEntries: [...languages].sort(),
  contentTypes: [...contentTypes].sort(),
  nativeApis: apiSources,
  discoveryOnly: discoverySources.sort(),
  invariant: 'discovery-never-grants-download-rights',
};

console.log(JSON.stringify(result, null, 2));
