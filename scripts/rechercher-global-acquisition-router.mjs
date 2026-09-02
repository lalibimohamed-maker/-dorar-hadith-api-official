#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { globalSearchAnalysts, GLOBAL_OUTCOMES } from '../src/rechercher-global-search.js';

const INPUT = process.env.INPUT_PATH ?? 'data/corpus/waqfeya/century-15/rechercher-eligibility/results.jsonl';
const OUTPUT = process.env.OUTPUT_PATH ?? 'data/corpus/rechercher/global-acquisition-routing.jsonl';
const DISCOVER = process.env.DISCOVER_ALTERNATIVES !== 'false';

const rows = (await readFile(INPUT, 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const routed = [];

for (const record of rows) {
  let analysis = { outcome: GLOBAL_OUTCOMES.NEEDS_DISCOVERY, selected: null, candidates: [], providerStatus: [] };
  let discoveryError = null;
  if (DISCOVER) {
    try {
      analysis = await globalSearchAnalysts(record);
    } catch (error) {
      discoveryError = error instanceof Error ? error.message : String(error);
    }
  }
  const selected = analysis.selected ?? null;
  routed.push({
    id: record.id,
    title: record.title ?? record.titleHint ?? null,
    author: record.author ?? null,
    originalSource: record.sourceUrl ?? record.sourcePage ?? null,
    originalRightsDecision: record.rightsDecision ?? 'unclear',
    acquisitionOutcome: selected ? 'use-alternative' : analysis.outcome,
    selectedAlternative: selected,
    candidates: analysis.candidates,
    providerStatus: analysis.providerStatus,
    discoveryAttempted: DISCOVER,
    discoveryError,
    originalRemainsDiscoverable: true,
    readOnlyFallback: !selected
  });
}

await mkdir(OUTPUT.substring(0, OUTPUT.lastIndexOf('/')) || '.', { recursive: true });
await writeFile(OUTPUT, routed.map(row => JSON.stringify(row)).join('\n') + (routed.length ? '\n' : ''));
console.log(JSON.stringify({
  total: routed.length,
  alternativeSelected: routed.filter(x => x.acquisitionOutcome === 'use-alternative').length,
  readOnlyFallback: routed.filter(x => x.readOnlyFallback).length,
  discoveryAttempted: routed.filter(x => x.discoveryAttempted).length,
  output: OUTPUT
}, null, 2));
