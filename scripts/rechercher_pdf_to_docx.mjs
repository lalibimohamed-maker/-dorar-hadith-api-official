#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import os from 'node:os';

const ROOT=process.cwd();
const args=process.argv.slice(2);
const arg=(name, fallback)=>{const i=args.indexOf(name); return i>=0 ? args[i+1] : fallback;};
const input=path.resolve(ROOT,arg('--input','artifacts/rechercher/multilingual-deep-pdf-expansion'));
const output=path.resolve(ROOT,arg('--output','artifacts/rechercher/multilingual-docx-expansion'));
const manifestOut=path.resolve(ROOT,arg('--manifest',path.join(output,'manifest.json')));
const strict=args.includes('--strict');

const sha256=b=>createHash('sha256').update(b).digest('hex');
const rel=p=>path.relative(ROOT,p);
const run=(cmd,argv)=>new Promise((resolve,reject)=>{
  const p=spawn(cmd,argv,{stdio:['ignore','pipe','pipe']});
  let stdout='',stderr=''; p.stdout.on('data',x=>stdout+=x); p.stderr.on('data',x=>stderr+=x);
  p.on('error',reject); p.on('close',code=>code===0?resolve({stdout,stderr}):reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-4000)}`)));
});
async function exists(p){try{await fs.access(p);return true}catch{return false}}
async function walk(dir){
  const out=[]; if(!(await exists(dir))) return out;
  for(const e of await fs.readdir(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory()) out.push(...await walk(p));
    else if(e.isFile() && /\.pdf$/i.test(e.name)) out.push(p);
  }
  return out;
}
function docxLooksValid(buf){
  return buf.subarray(0,2).toString()==='PK' &&
    buf.includes(Buffer.from('[Content_Types].xml')) &&
    buf.includes(Buffer.from('word/document.xml'));
}
async function findLibreOffice(){
  for(const c of ['libreoffice','soffice']) if(await exists(c).catch(()=>false)) return c;
  try{await run('sh',['-lc','command -v libreoffice || command -v soffice']); return 'libreoffice'}catch{}
  return null;
}
const converter=await findLibreOffice();
if(!converter) throw new Error('LibreOffice/soffice is required for PDF→DOCX conversion');

const pdfs=await walk(input);
const result={schema:'rechercher/pdf-to-docx/v1',generated_at:new Date().toISOString(),input_root:rel(input),output_root:rel(output),converter:'LibreOffice',policy:'derived-only; source PDFs are never modified or deleted',total_pdfs:pdfs.length,converted:0,failed:0,files:[]};
await fs.mkdir(output,{recursive:true});
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'rechercher-pdf-to-docx-'));

for(const pdf of pdfs){
  const bytes=await fs.readFile(pdf);
  const sourceSha=sha256(bytes);
  const relative=path.relative(input,pdf);
  const base=relative.replace(/\.pdf$/i,'');
  const dest=path.join(output,base+'.docx');
  await fs.mkdir(path.dirname(dest),{recursive:true});
  const workDir=path.join(temp,sha256(Buffer.from(relative)).slice(0,16));
  await fs.mkdir(workDir,{recursive:true});
  const staged=path.join(workDir,path.basename(pdf));
  await fs.copyFile(pdf,staged);
  const entry={source_pdf:rel(pdf),source_pdf_sha256:sourceSha,derived_docx:rel(dest),status:'failed',content_policy:'preserve-verbatim',derivation:'pdf-to-docx',review_status:'review-required'};
  try{
    await run(converter,['--headless','--convert-to','docx','--outdir',workDir,staged]);
    const generated=path.join(workDir,path.basename(pdf,'.pdf')+'.docx');
    if(!(await exists(generated))) throw new Error('LibreOffice produced no DOCX');
    const docx=await fs.readFile(generated);
    if(!docxLooksValid(docx)) throw new Error('Output is not a valid DOCX package');
    await fs.copyFile(generated,dest);
    entry.bytes=docx.length; entry.sha256=sha256(docx); entry.status='converted';
    result.converted++;
  }catch(error){
    entry.error=String(error.message||error); result.failed++;
  }
  result.files.push(entry);
}
await fs.rm(temp,{recursive:true,force:true});
await fs.writeFile(manifestOut,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({total_pdfs:result.total_pdfs,converted:result.converted,failed:result.failed,manifest:rel(manifestOut)}));
if(strict && result.failed) process.exit(1);
