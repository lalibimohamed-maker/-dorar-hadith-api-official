#!/usr/bin/env node
/**
 * Route a book by edition, not by source-wide restriction.
 *
 * Input JSONL rows may contain alternativeSources supplied by the governed
 * discovery layer. A rights-cleared alternative wins; otherwise the original
 * remains discoverable for read-only study. No arbitrary URL is invented here.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolveAlternativeSource } from '../src/rechercher-alternative-policy.js';

const INPUT = process.env.INPUT_PATH ?? 'data/corpus/waqfeya/century-15/rechercher-eligibility/results.jsonl';
const OUTPUT = process.env.OUTPUT_PATH ?? 'data/corpus/rechercher/acquisition-routing.jsonl';

const rows = (await readFile(INPUT, 'utf8'))
  .split(/\r?\n/).filter(Boolean).map(JSON.parse);

const routed = rows.map(record => {
  const result = resolveAlternativeSource(record);
  return {
    id: record.id,
    title: record.title ?? record.titleHint ?? null,
    originalSource: record.sourceUrl ?? record.sourcePage ?? null,
    originalRightsDecision: record.rightsDecision ?? 'unclear',
    acquisitionOutcome: result.outcome,
    selectedAlternative: result.selected ?? null,
    alternativeCandidates: result.candidatesConsidered,
    originalRemainsDiscoverable: true,
    readOnlyFallback: result.outcome !== 'use-alternative'
  };
});

await mkdir(OUTPUT.substring(0, OUTPUT.lastIndexOf('/')) || '.', { recursive: true });
await writeFile(OUTPUT, routed.map(x => JSON.stringify(x)).join('\n') + (routed.length ? '\n' : ''));
console.log(JSON.stringify({ total: routed.length, alternativeSelected: routed.filter(x => x.acquisitionOutcome === 'use-alternative').length, readOnlyFallback: routed.filter(x => x.readOnlyFallback).length, output: OUTPUT }, null, 2));
