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

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const runValidator=async(manifestPath)=>{
  const child=spawn(process.execPath,['scripts/rechercher_validate_multilingual_manifest.mjs',manifestPath],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});
  let out='',err='';
  child.stdout.on('data',x=>out+=x);
  child.stderr.on('data',x=>err+=x);
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
  return {code,out,err};
};

const makeFixture=async(deduplicated=true)=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rechercher-manifest-gate-'));
  const cells={};
  for(let i=0;i<3192;i++){
    cells[`cell-${String(i+1).padStart(4,'0')}`]={language:'Fixture',domain:'quran',files:[]};
  }
  cells['cell-0001'].files=[{
    source:'hadeethenc',
    url:'https://hadeethenc.com/item',
    bytes:123,
    sha256:'0'.repeat(64),
    rights:'review-required',
    provenance:'hadeethenc:test',
    deduplicated,
    duplicate_of:deduplicated?'durable-release-inventory':undefined
  }];
  const file=path.join(dir,'manifest.json');
  await fs.writeFile(file,JSON.stringify({schema:'rechercher/multilingual-resource-acquisition/v4',cell_count:3192,total_files:0,cells},null,2));
  return {dir,file};
};

test('strict gate accepts durable deduplicated references without a runner-local PDF path',async()=>{
  const fx=await makeFixture(true);
  try{
    const r=await runValidator(fx.file);
    assert.equal(r.code,0,r.out+r.err);
    const result=JSON.parse(r.out);
    assert.equal(result.total_files,0);
    assert.equal(result.file_records,1);
  }finally{await fs.rm(fx.dir,{recursive:true,force:true});}
});

test('strict gate still rejects a non-deduplicated file with no PDF path',async()=>{
  const fx=await makeFixture(false);
  try{
    const r=await runValidator(fx.file);
    assert.notEqual(r.code,0);
    assert.match(r.out,/not_pdf_path/);
  }finally{await fs.rm(fx.dir,{recursive:true,force:true});}
});
