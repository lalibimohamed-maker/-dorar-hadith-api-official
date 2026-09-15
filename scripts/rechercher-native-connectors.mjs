import { writeFile } from 'node:fs/promises';
import { NATIVE_SOURCES } from '../config/rechercher-native-sources.js';
import { createConnectorManifest } from '../src/rechercher/native-source-connectors.js';
import { federatedSearch, healthCheck } from '../src/rechercher/native-federation-engine.js';

const mode = process.argv[2] ?? 'manifest';
const query = process.argv.slice(3).join(' ').trim() || 'الحديث';

if (mode === 'manifest') {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), sources: createConnectorManifest(NATIVE_SOURCES) }, null, 2));
} else if (mode === 'health') {
  console.log(JSON.stringify(await healthCheck({ concurrency: 5 }), null, 2));
} else if (mode === 'search') {
  console.log(JSON.stringify(await federatedSearch(query, { concurrency: 5, timeoutMs: 12000 }), null, 2));
} else if (mode === 'health:file') {
  const result = await healthCheck({ concurrency: 5 });
  await writeFile('artifacts/rechercher-native-source-health.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} else {
  throw new Error(`Unknown mode: ${mode}`);
}
