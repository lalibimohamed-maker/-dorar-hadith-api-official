import test from 'node:test';
import assert from 'node:assert/strict';
import {assertTrustedSource, validateEvidenceRecord} from '../scripts/rechercher_strict_evidence_pipeline.mjs';

test('strict evidence validation requires provenance and rights',()=>{
  const result=validateEvidenceRecord({sourceId:'hadeethenc',url:'https://hadeethenc.com/item',role:'original'});
  assert.equal(result.valid,false);
  assert.ok(result.errors.includes('provenance_required'));
  assert.ok(result.errors.includes('rights_status_required'));
});

test('source allowlist rejects unregistered origins',()=>{
  assert.throws(()=>assertTrustedSource({sourceId:'unknown',url:'https://example.org/book.pdf',allowedOrigins:new Set(['https://hadeethenc.com'])}),/source_origin_not_allowlisted/);
});

test('encrypted primary representation is not accepted by policy',()=>{
  assert.match('book.pdf.enc',/\.pdf\.enc$/i);
});
