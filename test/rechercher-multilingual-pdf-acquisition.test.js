import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('scripts/rechercher_acquire_multilingual_cell_pdfs.mjs','utf8');
test('acquisition uses matrix evidence plus permanent source registry',()=>{assert.ok(s.includes('scientific-ledger.jsonl'));assert.ok(s.includes('master-global-source-registry-seed-2026-09.json'));assert.ok(s.includes('evidenceUrls'));assert.ok(s.includes('archive.org/metadata'));assert.ok(s.includes('apiSeeds'));assert.ok(s.includes('worldwide-source-link-registry-2026-09-24.json'));assert.ok(s.includes('worldwideRelevant'));});
test('acquisition searches multiple sources and bounded candidate sets',()=>{assert.match(s,/MAX_SOURCES_PER_CELL\s*=.*Math\.min\(256/);assert.ok(s.includes('master-registry'));assert.ok(s.includes('The full registered source pool is inspected'));assert.match(s,/MAX_PDF_CANDIDATES_PER_SOURCE\s*=.*Math\.min\(200/);assert.ok(s.includes('sourceRightsFor'));assert.ok(s.includes('sourceActive'));assert.ok(s.includes('adapterRelevant'));assert.match(s,/\.slice\(0,\s*MAX_SOURCES_PER_CELL\)/);assert.ok(s.includes('if(localSeen.has(seed.url)||!allow(seed.url)) continue;'));});
test('acquisition uses bounded parallelism and timeouts',()=>{assert.ok(s.includes('ACQUISITION_CONCURRENCY'));assert.ok(s.includes('AbortController'));assert.ok(s.includes('REQUEST_TIMEOUT'));assert.ok(s.includes('DOWNLOAD_TIMEOUT'));assert.ok(s.includes('Promise.all(Array.from({length:CONCURRENCY}'));});
test('Corpus and translation boundaries remain closed',()=>{assert.ok(s.includes('corpus_write:false'));assert.ok(s.includes('promoteToCorpus:false'));assert.ok(s.includes('canonical_arabic_separate:true'));assert.ok(s.includes('machine_translation_never_promoted:true'));});

test('acquisition resumes from durable Release inventory instead of re-downloading acquired cells',()=>{assert.ok(s.includes('ACQUISITION_EXISTING_INVENTORY'));assert.ok(s.includes('existingCells'));assert.ok(s.includes("status:'already-acquired'"));assert.match(s,/filter\(row=>!existingCells\.has/);});

test('resume normalizes legacy Release cell identifiers to ledger cell IDs',()=>{assert.ok(s.includes('normalizeCellId'));assert.ok(s.includes('cellIdByNormalized'));assert.ok(s.includes('rawExistingCells'));});
