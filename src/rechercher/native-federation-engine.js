import { NATIVE_SOURCES } from '../../config/rechercher-native-sources.js';
import { GLOBAL_MULTILINGUAL_PRIORITY } from '../../config/rechercher-global-multilingual-priority.js';
import { verifiedMultilingualSources } from '../../config/rechercher-verified-multilingual-connectors.js';
import { searchConnector, probeConnector } from './native-source-connectors.js';

function uniqueBy(records, key = (r) => `${r.sourceId}:${r.identifier ?? r.itemUrl ?? r.title}`) {
  const seen = new Set();
  return records.filter((record) => {
    const value = key(record);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

async function mapLimit(items, limit, worker) {
  const results = [];
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function priorityIds(options = {}) {
  return new Set((options.globalPriority ?? GLOBAL_MULTILINGUAL_PRIORITY).map((source) => source.id));
}

function mergeVerifiedSources(base, verified) {
  const verifiedById = new Map(verified.map((source) => [source.id, source]));
  const merged = base.map((source) => verifiedById.get(source.id) ?? source);
  for (const source of verified) if (!base.some((item) => item.id === source.id)) merged.push(source);
  return merged;
}

function buildSources(options = {}) {
  const base = options.sources ?? NATIVE_SOURCES;
  const effective = options.sources ? base : mergeVerifiedSources(base, verifiedMultilingualSources());
  const priority = priorityIds(options);
  return effective
    .filter((s) => s.enabled !== false)
    .sort((a, b) => Number(priority.has(b.id)) - Number(priority.has(a.id)));
}

export async function federatedSearch(query, options = {}) {
  const sources = buildSources(options);
  const started = Date.now();
  const priorities = priorityIds(options);
  const perSource = await mapLimit(sources, options.concurrency ?? 5, async (source) => {
    const sourceStarted = Date.now();
    try {
      const records = await searchConnector(source, query, options);
      return { sourceId: source.id, priority: priorities.has(source.id), status: 'success', records, elapsedMs: Date.now() - sourceStarted };
    } catch (error) {
      return { sourceId: source.id, priority: priorities.has(source.id), status: 'error', records: [], error: error.message, elapsedMs: Date.now() - sourceStarted };
    }
  });
  const records = uniqueBy(perSource.flatMap((result) => result.records));
  return { query, startedAt: new Date(started).toISOString(), elapsedMs: Date.now() - started, sourcesChecked: perSource.length, sourcesSucceeded: perSource.filter((r) => r.status === 'success').length, sourcesFailed: perSource.filter((r) => r.status === 'error').length, recordsFound: records.length, records, telemetry: perSource };
}

export async function healthCheck(options = {}) {
  const sources = buildSources(options);
  const results = await mapLimit(sources, options.concurrency ?? 5, (source) => probeConnector(source, options));
  return { checkedAt: new Date().toISOString(), sourcesChecked: results.length, healthy: results.filter((r) => r.status === 'healthy').length, degraded: results.filter((r) => r.status === 'degraded').length, configured: results.filter((r) => r.status === 'configured').length, results };
}

export function acquisitionCandidate(record) { return Boolean(record.pdfUrl) && record.rightsStatus !== 'restricted'; }
export function selectAcquisitionCandidates(records) { return uniqueBy(records.filter(acquisitionCandidate), (r) => r.pdfUrl); }
