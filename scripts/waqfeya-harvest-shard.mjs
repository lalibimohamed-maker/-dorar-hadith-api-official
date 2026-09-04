#!/usr/bin/env node
import { createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';

const INDEX=process.env.INDEX_PATH ?? 'data/corpus/waqfeya/century-15/index.jsonl';
const START=Number(process.env.BOOK_START ?? '0');
const COUNT=Number(process.env.BOOK_COUNT ?? '100');
const SHARD_ID=String(process.env.SHARD_ID ?? `start-${START}`);
const ELIGIBILITY=process.env.ELIGIBILITY_PATH ?? `data/corpus/waqfeya/century-15/rechercher-eligibility/eligible-index.jsonl`;
const OUT=`artifacts/waqfeya/${SHARD_ID}`;
const PDF_DIR=`${OUT}/pdf`;
const UA='Deen-Allah-Encyclopedia-Waqfeya-Harvester/2026';
function safeUrl(raw){try{const u=new URL(raw);return u.protocol==='https:'&&['waqfeya.net','www.waqfeya.net','archive.org','www.archive.org'].includes(u.hostname)?u.href:null;}catch{return null;}}
function txt(html){return html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();}
async function get(url){const r=await fetch(url,{redirect:'follow',headers:{'user-agent':UA,accept:'text/html,application/xhtml+xml'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text();}
function pdfLinks(html,page){const out=[];const re=/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;for(const m of html.matchAll(re)){try{const u=new URL(m[1],page).href;if(!safeUrl(u))continue;const l=txt(m[2]);if(/pdf|تحميل|download|archive\.org/i.test(`${l} ${u}`))out.push(u);}catch{}}return [...new Set(out)];}
async function download(url,out){const r=await fetch(url,{redirect:'follow',headers:{'user-agent':UA}});if(!r.ok)throw new Error(`download HTTP ${r.status}`);if(!r.body)throw new Error('empty response body');await pipeline(r.body,createWriteStream(out));}
async function isPdf(p){const b=Buffer.alloc(5);const fs=await import('node:fs/promises');const h=await fs.open(p,'r');try{await h.read(b,0,5,0);return b.toString('ascii')==='%PDF-';}finally{await h.close();}}
async function sha(p){const h=createHash('sha256');const f=(await import('node:fs')).createReadStream(p);for await(const c of f)h.update(c);return h.digest('hex');}
async function runClassifier(){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/rechercher-waqfeya-classify-shard.mjs'],{env:{...process.env,BOOK_START:String(START),BOOK_COUNT:String(COUNT),CONCURRENCY:process.env.CONCURRENCY??'4'},stdio:['ignore','inherit','inherit']});child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(`@Rechercher classifier exited ${code}`)));});}
async function main(){
 if(!Number.isInteger(START)||START<0||!Number.isInteger(COUNT)||COUNT<1||COUNT>100)throw new Error('BOOK_START invalid or BOOK_COUNT must be 1..100');
 const rows=(await readFile(INDEX,'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse).slice(START,START+COUNT);
 await mkdir(ELIGIBILITY.replace(/\/eligible-index\.jsonl$/,''),{recursive:true});
 try{await readFile(ELIGIBILITY,'utf8');}catch{await runClassifier();}
 const eligibleRows=new Map((await readFile(ELIGIBILITY,'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse).map(r=>[String(r.id),r]));
 await mkdir(PDF_DIR,{recursive:true});const results=[];
 for(const book of rows){const base={index:book.index,id:book.id,titleHint:book.titleHint,sourcePage:book.sourcePage,status:'pending'};try{
   const gate=eligibleRows.get(String(book.id));
   if(!gate||gate.eligibleForMirror!==true){results.push({...base,status:'excluded-by-rechercher',rightsDecision:gate?.rightsDecision??'not-present-in-eligibility-ledger'});continue;}
   const page=safeUrl(book.sourcePage);if(!page)throw new Error('invalid Waqfeya source URL');
   const html=await get(page);const candidates=pdfLinks(html,page);if(!candidates.length){results.push({...base,status:'eligible-but-no-direct-pdf-found',rightsDecision:gate.rightsDecision});continue;}
   let last='no candidate succeeded';const out=`${PDF_DIR}/${book.id}.pdf`;
   for(const u of candidates){try{await download(u,out);if(!(await isPdf(out)))throw new Error('not a PDF');const s=await stat(out);results.push({...base,status:'downloaded-and-verified',rightsDecision:gate.rightsDecision,downloadUrl:u,bytes:s.size,sha256:await sha(out)});last=null;break;}catch(e){last=e.message;await rm(out,{force:true});}}
   if(last)results.push({...base,status:'download-failed',rightsDecision:gate.rightsDecision,error:last});
 }catch(e){results.push({...base,status:'page-processing-failed',error:String(e?.message||e)});}}
 const verified=results.filter(r=>r.status==='downloaded-and-verified');
 const summary={shardId:SHARD_ID,requestedStart:START,requestedCount:COUNT,actualCount:rows.length,verifiedCount:verified.length,excludedByRechercherCount:results.filter(r=>r.status==='excluded-by-rechercher').length,failedCount:results.filter(r=>r.status.includes('failed')).length,generatedAt:new Date().toISOString(),rightsGate:'@Rechercher eligibility ledger is mandatory; free download or waqf wording alone never authorizes mirroring.'};
 const fs=await import('node:fs/promises'); await fs.writeFile(`${OUT}/manifest.json`,JSON.stringify({shard:summary,books:results},null,2)+'\n'); await fs.writeFile(`${OUT}/summary.json`,JSON.stringify(summary,null,2)+'\n'); await fs.writeFile(`${OUT}/pdfs.sha256`,verified.map(r=>`${r.sha256}  ${r.id}.pdf`).join('\n')+(verified.length?'\n':''));
 console.log(JSON.stringify(summary,null,2));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
