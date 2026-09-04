#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildSearchRecord, inspectSourceUrl } from '../src/rechercher-rights-engine.js';

const CATALOG = process.env.CATALOG || 'config/rechercher-source-catalog-2026.json';
const OUTPUT = process.env.OUTPUT || 'data/corpus/rechercher/source-audit-2026.json';
const MAX_SOURCES = Number(process.env.MAX_SOURCES || '100');
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || '4'));

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG, 'utf8'));
  const sources = (catalog.sources || []).slice(0, MAX_SOURCES);
  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < sources.length) {
      const item = sources[cursor++];
      try {
        const inspected = await inspectSourceUrl(item.url);
        const record = buildSearchRecord({
          source: item.name,
          sourceUrl: item.url,
          jurisdiction: item.country === 'DZ' ? { code: 'DZ', name: 'Algeria', termYears: 50 } : undefined,
          sourceClass: item.class
        }, inspected.metadata);
        results.push({
          ...record,
          httpStatus: inspected.httpStatus,
          finalUrl: inspected.finalUrl,
          contentType: inspected.contentType,
          fetchError: null
        });
      } catch (error) {
        results.push({
          source: item.name,
          sourceUrl: item.url,
          sourceClass: item.class,
          country: item.country,
          rightsDecision: 'unreachable',
          editionNeedsReview: true,
          fetchError: String(error?.message || error)
        });
      }
      await sleep(50);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, sources.length) }, () => worker()));
  results.sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl));
  const payload = {
    version: '2026.09.02',
    engine: '@Rechercher',
    catalog: CATALOG,
    generatedAt: new Date().toISOString(),
    sourceCount: results.length,
    policy: 'Discovery and legal triage only. A work may be acquired only after work-level and edition-level reuse rights are established for the target jurisdiction.',
    results
  };
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  payload.sha256 = createHash('sha256').update(serialized).digest('hex');
  await mkdir('data/corpus/rechercher', { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: OUTPUT, sourceCount: results.length, sha256: payload.sha256 }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message || error); process.exitCode = 1; });
