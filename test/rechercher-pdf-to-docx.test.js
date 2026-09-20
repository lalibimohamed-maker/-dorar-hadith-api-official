import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const run=(cmd,args,cwd)=>new Promise((resolve,reject)=>{
  const p=spawn(cmd,args,{cwd,stdio:['ignore','pipe','pipe']}); let out='',err='';
  p.stdout.on('data',x=>out+=x); p.stderr.on('data',x=>err+=x);
  p.on('error',reject); p.on('close',c=>c===0?resolve({out,err}):reject(new Error(err)));
});
test('PDF→DOCX engine converts without mutating source PDF', async ()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'rechercher-pdf-docx-test-'));
  const input=path.join(root,'input'); const output=path.join(root,'output');
  await fs.mkdir(input,{recursive:true});
  const pdf=[
    '%PDF-1.4\n',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n',
    '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<<>>/Contents 4 0 R>>endobj\n',
    '4 0 obj<</Length 0>>stream\nendstream\nendobj\n',
    'xref\n0 5\n0000000000 65535 f \n',
    '0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000211 00000 n \n',
    'trailer<</Size 5/Root 1 0 R>>\nstartxref\n260\n%%EOF\n'
  ].join('');
  const pdfPath=path.join(input,'sample.pdf'); await fs.writeFile(pdfPath,pdf);
  const before=await fs.readFile(pdfPath);
  const script=path.resolve(process.cwd(),'scripts/rechercher_pdf_to_docx.mjs');
  await run(process.execPath,[script,'--input',input,'--output',output,'--strict'],process.cwd());
  const after=await fs.readFile(pdfPath);
  assert.deepEqual(after,before);
  const docx=path.join(output,'sample.docx');
  const d=await fs.readFile(docx);
  assert.equal(d.subarray(0,2).toString(),'PK');
  assert.ok(d.includes(Buffer.from('word/document.xml')));
  const manifest=JSON.parse(await fs.readFile(path.join(output,'manifest.json'),'utf8'));
  assert.equal(manifest.total_pdfs,1);
  assert.equal(manifest.converted,1);
  assert.equal(manifest.failed,0);
  await fs.rm(root,{recursive:true,force:true});
});
