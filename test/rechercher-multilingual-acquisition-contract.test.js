import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=async p=>readFile(new URL(p,root),'utf8');

test('multilingual acquisition uses the existing durable matrix storage and local source registry',async()=>{
  const caller=await read('.github/workflows/rechercher-global-multilingual-execution.yml');
  const acq=await read('.github/workflows/rechercher-multilingual-pdf-acquisition.yml');
  const registry=JSON.parse(await read('research/evidence/global-multilingual/worldwide-source-link-registry-2026-09-24.json'));
  assert.match(caller,/MATRIX_STORAGE_REPO:\s*lalibimohamed-maker\/dinullah-matrix-3192-storage-01/);
  assert.match(acq,/MATRIX_STORAGE_REPO:\s*lalibimohamed-maker\/dinullah-matrix-3192-storage-01/);
  assert.doesNotMatch(caller,/dinullah-matrix-4921-storage-01/);
  assert.doesNotMatch(acq,/dinullah-matrix-4921-storage-01/);
  assert.ok(Array.isArray(registry.sources) && registry.sources.length>=500);
  assert.ok(registry.sources.every(s=>s.rights_status==='review_required'));
});

test('language-aware API and download contracts are explicit',async()=>{
  const script=await read('scripts/rechercher_acquire_multilingual_cell_pdfs.mjs');
  assert.doesNotMatch(script,/SOURCE_REGISTRY_561_URL|feat\/rechercher-worldwide-source-link-registry-2026-09-24/);
  assert.match(script,/SOURCE_REGISTRY_PATH=path\.join/);
  assert.match(script,/\['language','lang','locale'\]/);
  assert.match(script,/sourceLanguage:'ar'/);
  assert.match(script,/unresolved=/);
  assert.match(script,/\[PDF PROGRESS\]/);
  assert.match(script,/\[PDF DONE\]/);
  assert.match(script,/promoteToCorpus:false/);
  assert.match(script,/discovery_is_not_permission:true/);
});

test('Release verification is fail-closed after upload',async()=>{
  const acq=await read('.github/workflows/rechercher-multilingual-pdf-acquisition.yml');
  assert.match(acq,/MATRIX_RELEASE_SHA_VERIFY_OK/);
  assert.match(acq,/MATRIX_RELEASE_SHA_VERIFY_FAIL/);
  assert.match(acq,/releases\/tags\/\$tag/);
});
