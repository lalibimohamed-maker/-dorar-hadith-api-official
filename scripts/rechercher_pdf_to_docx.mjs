#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import os from 'node:os';
const ROOT=process.cwd(), args=process.argv.slice(2);
const arg=(n,d)=>{const i=args.indexOf(n);return i>=0?args[i+1]:d};
const input=path.resolve(ROOT,arg('--input','artifacts/rechercher/multilingual-deep-pdf-expansion'));
const output=path.resolve(ROOT,arg('--output','artifacts/rechercher/multilingual-docx-expansion'));
const manifestOut=path.resolve(ROOT,arg('--manifest',path.join(output,'manifest.json')));
const strict=args.includes('--strict');
const exists=async p=>{try{await fs.access(p);return true}catch{return false}};
const run=(cmd,a)=>new Promise((res,rej)=>{
 if(!path.isAbsolute(cmd) || !['/usr/local/bin/rechercher-python3','/usr/bin/python3','/usr/bin/libreoffice','/usr/bin/soffice'].includes(cmd))
   return rej(new Error('unsupported executable'));
 const p=spawn(cmd,a,{stdio:['ignore','pipe','pipe']});let o='',e='';
 p.stdout.on('data',x=>o+=x);p.stderr.on('data',x=>e+=x);p.on('error',rej);
 p.on('close',c=>c===0?res({o,e}):rej(new Error(cmd+' exited '+c+': '+e.slice(-3000))));
});
async function walk(d){const r=[];if(!(await exists(d)))return r;for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())r.push(...await walk(p));else if(e.isFile()&&/\.pdf$/i.test(e.name))r.push(p)}return r}
const PYTHON_CANDIDATES=['/usr/local/bin/rechercher-python3','/usr/bin/python3'];
async function findPython(){for(const c of PYTHON_CANDIDATES){try{await fs.access(c);return c}catch{}}return null}
async function pythonAvailable(){const py=await findPython();if(!py)return null;try{await run(py,['-c','import pymupdf,docx']);return py}catch{return null}}
async function findLO(){for(const c of ['/usr/bin/libreoffice','/usr/bin/soffice']){try{await fs.access(c);return c}catch{}}return null}
async function main(){
 await fs.mkdir(output,{recursive:true});
 const py=await pythonAvailable();
 if(py){
  try{await run(py,[path.join(ROOT,'scripts/rechercher_pdf_to_docx.py'),'--input',input,'--output',output,'--manifest',manifestOut,...(strict?['--strict']:[])]);console.log(JSON.stringify({engine:'PyMuPDF+python-docx',manifest:manifestOut}));return}catch(e){if(strict)throw e}
 }
 const lo=await findLO();if(!lo)throw new Error('Neither PyMuPDF/python-docx nor LibreOffice is available');
 const files=await walk(input),entries=[];
 for(const pdf of files){
  const rel=path.relative(input,pdf),dest=path.join(output,rel.replace(/\.pdf$/i,'.docx'));await fs.mkdir(path.dirname(dest),{recursive:true});
  const b=await fs.readFile(pdf),source=createHash('sha256').update(b).digest('hex'),tmp=await fs.mkdtemp(path.join(os.tmpdir(),'rechercher-lo-')),staged=path.join(tmp,path.basename(pdf));
  const e={source_pdf:path.relative(ROOT,pdf),source_pdf_sha256:source,derived_docx:path.relative(ROOT,dest),status:'failed',content_policy:'preserve-verbatim',derivation:'libreoffice-fallback',review_status:'review-required',sacred_text_flag:'requires_review',arabic_alignment_verified:false,ocr_used:false};
  try{await fs.copyFile(pdf,staged);await run(lo,['--headless','--convert-to','docx','--outdir',tmp,staged]);const g=path.join(tmp,path.basename(pdf,'.pdf')+'.docx');if(!(await exists(g)))throw Error('LibreOffice produced no DOCX');await fs.copyFile(g,dest);e.status='converted';e.derived_docx_sha256=createHash('sha256').update(await fs.readFile(dest)).digest('hex')}catch(x){e.error=String(x.message||x)}finally{await fs.rm(tmp,{recursive:true,force:true})}entries.push(e)
 }
 const m={schema:'rechercher/pdf-to-docx/v2',converter:'LibreOffice-fallback',policy:'derived-only; source PDFs are never modified or deleted',files:entries,total_pdfs:entries.length,converted:entries.filter(e=>e.status==='converted').length,failed:entries.filter(e=>e.status==='failed').length,deferred_large_files:0};
 await fs.writeFile(manifestOut,JSON.stringify(m,null,2)+'\n');if(strict&&m.failed)process.exit(1);console.log(JSON.stringify(m));
}
await main();
