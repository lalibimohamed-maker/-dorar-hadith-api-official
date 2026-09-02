#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolveAlternativeSource } from '../src/rechercher-alternative-policy.js';
import { governedAlternativeDiscovery } from '../src/rechercher-alternative-discovery.js';

const INPUT = process.env.INPUT_PATH ?? 'data/corpus/waqfeya/century-15/rechercher-eligibility/results.jsonl';
const OUTPUT = process.env.OUTPUT_PATH ?? 'data/corpus/rechercher/acquisition-routing.jsonl';
const DISCOVER = process.env.DISCOVER_ALTERNATIVES !== 'false';

const rows = (await readFile(INPUT, 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const routed = [];

for (const record of rows) {
  const initial = resolveAlternativeSource(record);
  let candidates = Array.isArray(record.alternativeSources) ? record.alternativeSources : [];
  if (DISCOVER && initial.outcome !== 'use-alternative') {
    try {
      candidates = [...candidates, ...(await governedAlternativeDiscovery(record))];
    } catch (error) {
      record.discoveryError = error instanceof Error ? error.message : String(error);
    }
  }
  const result = resolveAlternativeSource({ ...record, alternativeSources: candidates });
  routed.push({
    id: record.id,
    title: record.title ?? record.titleHint ?? null,
    originalSource: record.sourceUrl ?? record.sourcePage ?? null,
    originalRightsDecision: record.rightsDecision ?? 'unclear',
    acquisitionOutcome: result.outcome,
    selectedAlternative: result.selected ?? null,
    alternativeCandidates: result.candidatesConsidered,
    discoveryAttempted: DISCOVER && initial.outcome !== 'use-alternative',
    discoveryError: record.discoveryError ?? null,
    originalRemainsDiscoverable: true,
    readOnlyFallback: result.outcome !== 'use-alternative'
  });
}

await mkdir(OUTPUT.substring(0, OUTPUT.lastIndexOf('/')) || '.', { recursive: true });
await writeFile(OUTPUT, routed.map(x => JSON.stringify(x)).join('\n') + (routed.length ? '\n' : ''));
console.log(JSON.stringify({ total: routed.length, alternativeSelected: routed.filter(x => x.acquisitionOutcome === 'use-alternative').length, readOnlyFallback: routed.filter(x => x.readOnlyFallback).length, discoveryAttempted: routed.filter(x => x.discoveryAttempted).length, output: OUTPUT }, null, 2));
