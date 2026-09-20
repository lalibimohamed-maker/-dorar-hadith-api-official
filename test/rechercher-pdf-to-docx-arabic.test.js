import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
const run=(cmd,args,cwd)=>new Promise((resolve,reject)=>{const p=spawn(cmd,args,{cwd,stdio:['ignore','pipe','pipe']});let e='';p.stderr.on('data',x=>e+=x);p.on('error',reject);p.on('close',c=>c?reject(new Error(e||String(c))):resolve())});
test('structural PDF to DOCX emits provenance and preserves source',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rechercher-ar-')),input=path.join(root,'input'),output=path.join(root,'output'),pdf=path.join(input,'arabic.pdf'),manifest=path.join(output,'manifest.json');
 await fs.mkdir(input,{recursive:true});
 await run('python3',['-c','import pymupdf; d=pymupdf.open(); p=d.new_page(); p.insert_text((500,100),"\u0627\u0644\u0644\u0647 \u0631\u062d\u0645\u0629 \u0648\u0633\u0644\u0627\u0645",fontname="helv",fontsize=18); d.save(r"'+pdf.replace(/"/g,'\"')+'")'],process.cwd());
 const before=await fs.readFile(pdf);
 await run('python3',['scripts/rechercher_pdf_to_docx.py','--input',input,'--output',output,'--manifest',manifest],process.cwd());
 assert.deepEqual(await fs.readFile(pdf),before);
 const m=JSON.parse(await fs.readFile(manifest,'utf8'));assert.equal(m.schema,'rechercher/pdf-to-docx/v2');assert.equal(m.converted,1);assert.equal(m.failed,0);
 const d=await fs.readFile(path.join(output,'arabic.docx'));assert.equal(d.subarray(0,2).toString(),'PK');assert.ok(d.includes(Buffer.from('word/document.xml')));
 await fs.rm(root,{recursive:true,force:true});
});
