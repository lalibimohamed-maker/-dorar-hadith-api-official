#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { validateRepairAndQualityGate } from "./rechercher_docx_pdf_fallback.mjs";
const execFileAsync = promisify(execFile);

const ROOT=process.cwd();
const REGISTRY_URL="https://raw.githubusercontent.com/lalibimohamed-maker/-dorar-hadith-api-official/feat/rechercher-worldwide-source-link-registry-2026-09-24/research/evidence/global-multilingual/worldwide-source-link-registry-2026-09-24.json";
const OUT=path.join(ROOT,"artifacts/quran-561-registry-acquisition");
const MAX_SOURCE_BYTES=3*1024*1024;
const MAX_PDFS_PER_SOURCE=30;
const MAX_DEPTH=2;
const MAX_SOURCES=Math.max(1,Math.min(128,Number(process.env.QURAN_561_MAX_SOURCES||128)));
const CONCURRENCY=Math.max(1,Math.min(8,Number(process.env.QURAN_561_CONCURRENCY||6)));

function sha256(data){return crypto.createHash("sha256").update(data).digest("hex");}
function safeSegment(v){return String(v||"unknown").replace(/[^A-Za-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,100)||"unknown";}
function quranRelevant(s){
  const t=[s?.category,s?.name,s?.role,s?.notes,s?.capabilities,s?.languages].flat().filter(Boolean).join(" ").toLowerCase();
  return /quran|mushaf|kfgqpc|tafsir|qira.?at|recitation|ayah/.test(t);
}
function sameOrigin(a,b){
  try{return new URL(a).origin===new URL(b).origin;}catch{return false;}
}
async function fetchBytes(url){
  const r=await fetch(url,{redirect:"follow",headers:{
    "user-agent":"DinAllah-Rechercher/561-Quran-Acquisition/1.0",
    accept:"application/pdf,text/html,application/xhtml+xml,application/json,*/*;q=0.1"
  }});
  if(!r.ok) throw new Error("HTTP "+r.status);
  const bytes=Buffer.from(await r.arrayBuffer());
  if(bytes.length>MAX_SOURCE_BYTES) throw new Error("source response too large");
  return {bytes,finalUrl:r.url||url,contentType:r.headers.get("content-type")||""};
}
function isPdf(url,contentType="",bytes){
  return /^application\/pdf/i.test(contentType)||bytes?.subarray(0,5).toString("ascii")==="%PDF-"||/\.pdf(?:[?#]|$)/i.test(url);
}
function isDocx(url,contentType="",bytes){
  return /wordprocessingml\.document/i.test(contentType)||bytes?.subarray(0,2).toString("hex")==="504b"||/\.docx(?:[?#]|$)/i.test(url);
}
function extractLinks(text,base){
  const out=new Set();
  const re=/(?:href|src|data-url|data-href|data-pdf)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while((m=re.exec(text))!==null){
    try{
      const u=new URL(m[1],base);
      if(u.protocol==="https:"&&!u.username&&!u.password&&sameOrigin(u.href,base)) out.add(u.href);
    }catch{}
  }
  for(const raw of text.match(/https:\/\/[^\s"'<>]+\.pdf(?:\?[^\s"'<>]*)?/gi)||[]){
    try{const u=new URL(raw);if(u.protocol==="https:"&&!u.username&&!u.password&&sameOrigin(u.href,base))out.add(u.href);}catch{}
  }
  return [...out];
}
async function discover(seed){
  const queue=[{url:seed,depth:0}],visited=new Set(),pdfs=new Set(),docxs=new Set();
  while(queue.length&&visited.size<80&&pdfs.size<MAX_PDFS_PER_SOURCE){
    const {url,depth}=queue.shift();
    if(visited.has(url)||depth>MAX_DEPTH) continue;
    visited.add(url);
    let r;
    try{r=await fetchBytes(url);}catch{continue;}
    if(isPdf(r.finalUrl,r.contentType,r.bytes)){pdfs.add(r.finalUrl);continue;}
    if(isDocx(r.finalUrl,r.contentType,r.bytes)){docxs.add(r.finalUrl);continue;}
    const text=r.bytes.toString("utf8");
    for(const u of extractLinks(text,r.finalUrl)){
      if(/\.pdf(?:[?#]|$)/i.test(u)) pdfs.add(u);
      else if(depth<MAX_DEPTH&&!visited.has(u)) queue.push({url:u,depth:depth+1});
      if(pdfs.size>=MAX_PDFS_PER_SOURCE) break;
    }
  }
  return {pdfs:[...pdfs],docxs:[...docxs]};
}
async function download(url){
  const r=await fetch(url,{redirect:"follow",headers:{
    "user-agent":"DinAllah-Rechercher/561-Quran-PDF/1.0",
    accept:"application/pdf,*/*;q=0.1"
  }});
  if(!r.ok) throw new Error("HTTP "+r.status);
  const data=Buffer.from(await r.arrayBuffer());
  if(data.subarray(0,5).toString("ascii")!=="%PDF-") throw new Error("not a PDF");
  if(data.length>750*1024*1024) throw new Error("PDF exceeds 750 MiB limit");
  return data;
}

const registry=await (async()=>{
  const r=await fetch(REGISTRY_URL,{headers:{accept:"application/json"}});
  if(!r.ok) throw new Error("PR #561 registry HTTP "+r.status);
  return r.json();
})();
const sources=(registry.sources||[])
  .filter(s=>s&&s.rights_status==="review_required"&&quranRelevant(s))
  .slice(0,MAX_SOURCES);
await fs.rm(OUT,{recursive:true,force:true});
await fs.mkdir(OUT,{recursive:true});

const sourceResults=new Array(sources.length);
let next=0;
async function worker(){
  while(true){
    const i=next++;
    if(i>=sources.length) return;
    const s=sources[i];
    const row={id:s.id,name:s.name,url:s.url,category:s.category,rights_status:"review_required",pdf_candidates:[],downloaded:[],errors:[]};
    try{
      const candidates=await discover(s.url);
      row.pdf_candidates=[...new Set(candidates.pdfs)];
      row.docx_candidates=[...new Set(candidates.docxs)];
      for(const pdfUrl of row.pdf_candidates){
        try{
          const data=await download(pdfUrl);
          const sha=sha256(data);
          const ext=".pdf";
          const dir=path.join(OUT,safeSegment(s.id));
          await fs.mkdir(dir,{recursive:true});
          const file=path.join(dir,sha+"_"+safeSegment(path.basename(new URL(pdfUrl).pathname)) || (sha+ext));
          const final=file.endsWith(".pdf")?file:file+".pdf";
          const seenPath=path.join(OUT,"_sha256-index.json");
          row.downloaded.push({source:s.id,url:pdfUrl,path:path.relative(ROOT,final),bytes:data.length,sha256:sha,rights_status:"review_required"});
          try{await fs.access(final);}catch{await fs.writeFile(final,data);}
        }catch(e){row.errors.push({url:pdfUrl,error:String(e?.message||e)});}
      }
      // DOCX is a fallback only when no PDF was acquired from this source.
      if(row.downloaded.length===0){
        for(const docxUrl of row.docx_candidates){
          try{
            const data=await (async()=>{
              const r=await fetch(docxUrl,{redirect:"follow",headers:{"user-agent":"DinAllah-Rechercher/561-Quran-DOCX/1.0","accept":"application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/octet-stream,*/*;q=0.1"}});
              if(!r.ok) throw new Error("HTTP "+r.status);
              return Buffer.from(await r.arrayBuffer());
            })();
            if(data.subarray(0,2).toString("hex")!=="504b") throw new Error("not a DOCX container");
            const dir=path.join(OUT,safeSegment(s.id));
            await fs.mkdir(dir,{recursive:true});
            const token=sha256(data).slice(0,16);
            const docxPath=path.join(dir,token+"_"+safeSegment(path.basename(new URL(docxUrl).pathname)||"source.docx"));
            const pdfPath=path.join(dir,token+"_derived.pdf");
            await fs.writeFile(docxPath,data);
            await execFileAsync("libreoffice",["--headless","--nologo","--nodefault","--nolockcheck","--norestore","--convert-to","pdf:writer_pdf_Export","--outdir",dir,docxPath],{timeout:120000,maxBuffer:4*1024*1024});
            const produced=path.join(dir,path.basename(docxPath).replace(/\.docx$/i,".pdf"));
            if(produced!==pdfPath) await fs.rename(produced,pdfPath);
            await validateRepairAndQualityGate(pdfPath);
            const pdfData=await fs.readFile(pdfPath);
            const pdfSha=sha256(pdfData);
            row.downloaded.push({source:s.id,url:docxUrl,path:path.relative(ROOT,pdfPath),original_docx:path.relative(ROOT,docxPath),bytes:pdfData.length,sha256:pdfSha,derived:true,derived_from_format:"docx",rights_status:"review_required"});
            break;
          }catch(e){row.errors.push({url:docxUrl,error:String(e?.message||e)});}
        }
      }
    }catch(e){row.errors.push({source:s.url,error:String(e?.message||e)});}
    sourceResults[i]=row;
  }
}
await Promise.all(Array.from({length:CONCURRENCY},worker));

const manifest={
  schema:"rechercher/quran-561-registry-acquisition/v1",
  generated_at:new Date().toISOString(),
  source_registry_pr:561,
  source_registry_branch:"feat/rechercher-worldwide-source-link-registry-2026-09-24",
  source_count:sources.length,
  crawled_sources:sourceResults.filter(Boolean).length,
  pdf_candidates:sourceResults.reduce((n,s)=>n+s.pdf_candidates.length,0),
  docx_candidates:sourceResults.reduce((n,s)=>n+(s.docx_candidates?.length||0),0),
  downloaded_pdfs:sourceResults.reduce((n,s)=>n+s.downloaded.length,0),
  downloaded_docx_derived_pdfs:sourceResults.reduce((n,s)=>n+s.downloaded.filter(x=>x.derived).length,0),
  rights_status:"review_required_for_all",
  corpus_write:false,
  ai_generated_translation:false,
  canonical_arabic_separate:true,
  public_redistribution_grant:false,
  sources:sourceResults,
};
await fs.writeFile(path.join(OUT,"manifest.json"),JSON.stringify(manifest,null,2)+"\n","utf8");
console.log(JSON.stringify({
  source_count:manifest.source_count,
  pdf_candidates:manifest.pdf_candidates,
  downloaded_pdfs:manifest.downloaded_pdfs
},null,2));
