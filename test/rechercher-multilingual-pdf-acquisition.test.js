import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('scripts/rechercher_acquire_multilingual_cell_pdfs.mjs','utf8');
test('acquisition uses matrix evidence plus permanent source registry',()=>{assert.match(s,/scientific-ledger\.jsonl/);assert.match(s,/master-global-source-registry-seed-2026-09\.json/);assert.match(s,/evidenceUrls/);assert.match(s,/archive\.org\/metadata/);assert.match(s,/apiSeeds/);});
test('acquisition uses bounded parallelism and timeouts',()=>{assert.match(s,/ACQUISITION_CONCURRENCY/);assert.match(s,/AbortController/);assert.match(s,/REQUEST_TIMEOUT/);assert.match(s,/DOWNLOAD_TIMEOUT/);assert.match(s,/Promise\.all\(Array\.from\(\{length:CONCURRENCY\}/);});
test('Corpus and translation boundaries remain closed',()=>{assert.match(s,/corpus_write:false/);assert.match(s,/promoteToCorpus:false/);assert.match(s,/canonical_arabic_separate:true/);assert.match(s,/machine_translation_never_promoted:true/);});
