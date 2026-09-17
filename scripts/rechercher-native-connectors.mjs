import { mkdir, writeFile } from 'node:fs/promises';
import { NATIVE_SOURCES } from '../config/rechercher-native-sources.js';
import { VERIFIED_MULTILINGUAL_CONNECTORS } from '../config/rechercher-verified-multilingual-connectors.js';
import GLOBAL_MULTILINGUAL_SOURCES from '../config/rechercher-global-multilingual-sources-v2.js';
import { createConnectorManifest, discoverConnector } from '../src/rechercher/native-source-connectors.js';
import { federatedSearch, healthCheck } from '../src/rechercher/native-federation-engine.js';
import { assertSourceCensus, buildSourceCensus } from '../src/rechercher/source-census.js';

const mode = process.argv[2] ?? 'manifest';
const query = process.argv.slice(3).join(' ').trim() || 'الحديث';

await mkdir('artifacts', { recursive: true });

if (mode === 'manifest') {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), sources: createConnectorManifest(NATIVE_SOURCES) }, null, 2));
} else if (mode === 'global-manifest') {
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    registry: 'global-multilingual-v2',
    sources: GLOBAL_MULTILINGUAL_SOURCES,
    nativeApis: GLOBAL_MULTILINGUAL_SOURCES.filter((source) => source.api?.documented).map((source) => ({ id: source.id, api: source.api })),
  }, null, 2));
} else if (mode === 'global-census') {
  const languages = new Set();
  const contentTypes = new Set();
  const nativeApis = [];
  for (const source of GLOBAL_MULTILINGUAL_SOURCES) {
    for (const language of (Array.isArray(source.languages) ? source.languages : [source.languages])) languages.add(language);
    for (const type of source.content ?? []) contentTypes.add(type);
    if (source.api?.documented) nativeApis.push(source.id);
  }
  const census = {
    generatedAt: new Date().toISOString(),
    registry: 'global-multilingual-v2',
    sourceCount: GLOBAL_MULTILINGUAL_SOURCES.length,
    nativeApiSourceCount: nativeApis.length,
    nativeApiSources: nativeApis,
    languageDirectoryEntries: [...languages].sort(),
    contentTypes: [...contentTypes].sort(),
    discoveryOnlySourceCount: GLOBAL_MULTILINGUAL_SOURCES.filter((source) => source.api == null).length,
    invariant: 'discovery-never-grants-download-rights',
  };
  await writeFile('artifacts/rechercher-global-multilingual-census.json', JSON.stringify(census, null, 2));
  console.log(JSON.stringify(census, null, 2));
} else if (mode === 'census') {
  const census = assertSourceCensus(buildSourceCensus());
  await writeFile('artifacts/rechercher-source-census.json', JSON.stringify(census, null, 2));
  console.log(JSON.stringify(census, null, 2));
} else if (mode === 'health') {
  console.log(JSON.stringify(await healthCheck({ concurrency: 5 }), null, 2));
} else if (mode === 'search') {
  console.log(JSON.stringify(await federatedSearch(query, { concurrency: 5, timeoutMs: 12000 }), null, 2));
} else if (mode === 'hadeethenc-discover') {
  const source = VERIFIED_MULTILINGUAL_CONNECTORS.find((item) => item.id === 'hadeethenc-api');
  if (!source) throw new Error('hadeethenc-api connector is not registered');
  const language = process.env.HADEETHENC_LANGUAGE || undefined;
  const result = await discoverConnector(source, {
    language,
    concurrency: 1,
    timeoutMs: 15000,
    pageSize: 100,
    onProgress: ({ language: currentLanguage, categoryId, pagesRead, recordsFound }) => {
      console.log(JSON.stringify({ event: 'progress', sourceId: source.id, language: currentLanguage, categoryId, pagesRead, recordsFound }));
    },
  });
  await writeFile('artifacts/rechercher-hadeethenc-full-discovery.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ sourceId: result.sourceId, strategy: result.strategy, languagesChecked: result.languagesChecked, recordsFound: result.recordsFound, elapsedMs: result.elapsedMs, telemetryEntries: result.telemetry.length }, null, 2));
} else if (mode === 'health:file') {
  const result = await healthCheck({ concurrency: 5 });
  await writeFile('artifacts/rechercher-native-source-health.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} else {
  throw new Error(`Unknown mode: ${mode}`);
}
