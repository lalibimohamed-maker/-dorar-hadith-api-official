#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildSearchRecord, inspectSourceUrl } from '../src/rechercher-rights-engine.js';

const CATALOG = process.env.CATALOG || 'config/rechercher-source-catalog-2026.json';
const LINK_MANIFEST = process.env.LINK_MANIFEST || 'data/corpus/rechercher/docx-links-2026.json';
const OUTPUT = process.env.OUTPUT || 'data/corpus/rechercher/source-audit-2026.json';
const MAX_SOURCES = Number(process.env.MAX_SOURCES || '100');
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || '4'));

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function sourceFromUrl(url) { try { return new URL(url).hostname; } catch { return 'invalid-url'; } }
function findCatalogMeta(url, catalog) { return (catalog.sources || []).find(item => item.url === url) || null; }

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG, 'utf8'));
  const manifest = JSON.parse(await readFile(LINK_MANIFEST, 'utf8'));
  const urls = [...new Set(manifest.urls || [])].slice(0, MAX_SOURCES);
  const sources = urls.map(url => {
    const meta = findCatalogMeta(url, catalog);
    return meta || { name: sourceFromUrl(url), url, class: 'docx-discovered', country: null };
  });
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
          sourceClass: item.class,
          country: item.country
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
    linkManifest: LINK_MANIFEST,
    normalizedDocxUrlCount: manifest.uniqueNormalizedUrlCount,
    generatedAt: new Date().toISOString(),
    sourceCount: results.length,
    policy: 'Discovery and legal triage only. A work may be acquired only after work-level and edition-level reuse rights are established for the target jurisdiction.',
    results
  };
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  payload.sha256 = createHash('sha256').update(serialized).digest('hex');
  await mkdir('data/corpus/rechercher', { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: OUTPUT, sourceCount: results.length, normalizedDocxUrlCount: manifest.uniqueNormalizedUrlCount, sha256: payload.sha256 }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message || error); process.exitCode = 1; });
