#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildSearchRecord, inspectSourceUrl, searchAuthorDeath, RIGHTS_DECISIONS } from '../src/rechercher-rights-engine.js';

const INDEX='data/corpus/waqfeya/century-15/index.jsonl';
const OUT='data/corpus/waqfeya/century-15/rechercher-eligibility';
const START=Number(process.env.BOOK_START ?? '0');
const COUNT=Number(process.env.BOOK_COUNT ?? '100');
const CONCURRENCY=Math.max(1,Number(process.env.CONCURRENCY ?? '4'));

function text(html){return html.replace(/<script[\s\S]*?<\/script>/giu,' ').replace(/<style[\s\S]*?<\/style>/giu,' ').replace(/<[^>]+>/gu,' ').replace(/&nbsp;|&#160;/giu,' ').replace(/&amp;/giu,'&').replace(/&quot;/giu,'"').replace(/&#39;|&apos;/giu,"'").replace(/\s+/gu,' ').trim();}
function field(t, labels){ for(const label of labels){ const m=t.match(new RegExp(`${label}\\s*[:：-]?\\s*([^|؛;,.]{2,160})`,'iu')); if(m)return m[1].trim(); } return null; }
function year(t){const m=t.match(/(?:سنة|عام|تاريخ)\s*(?:النشر|الطبع)?\s*[:：-]?\s*(1[2-4]\d{2}|19\d{2}|20\d{2})/u);return m?Number(m[1]):null;}
async function run(items, fn){let i=0;await Promise.all(Array.from({length:Math.min(CONCURRENCY,items.length)},async()=>{while(true){const n=i++;if(n>=items.length)return;await fn(items[n]);}}));}
async function main(){
 const rows=(await readFile(INDEX,'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse).slice(START,START+COUNT);
 const results=[]; const deathCache=new Map();
 await run(rows,async book=>{
  const base={...book,sourceUrl:book.sourcePage,source:'Waqfeya',sourceClass:'book'};
  try{
   const inspected=await inspectSourceUrl(book.sourcePage);
   const t=inspected.metadata.text;
   const author=inspected.metadata.author||field(t,['المؤلف','تأليف','بقلم']);
   const editor=field(t,['تحقيق','المحقق','إعداد','جمع']);
   const publisher=inspected.metadata.publisher||field(t,['الناشر','الناشر:','الطبعة عن','دار']);
   const rights=inspected.metadata.rights;
   let authorDeathYear=null; let deathEvidence=null;
   if(author){
    if(!deathCache.has(author)) deathCache.set(author,searchAuthorDeath(author).catch(()=>({found:false})));
    const d=await deathCache.get(author); if(d?.found){authorDeathYear=d.deathYear;deathEvidence=d;}
   }
   const record=buildSearchRecord({...base,author,editor,publisher,editionYear:year(t),authorDeathYear,license:rights},inspected.metadata);
   const evidence=(record.rightsEvidence||[]).map(e=>e.kind);
   const conservative=(record.rightsDecision===RIGHTS_DECISIONS.LICENSED||record.rightsDecision===RIGHTS_DECISIONS.REDISTRIBUTABLE)&&!record.editionNeedsReview;
   results.push({...record,editor,authorDeathEvidence:deathEvidence,evidenceKinds:evidence,eligibleForMirror:conservative,httpStatus:inspected.httpStatus,finalUrl:inspected.finalUrl});
  }catch(error){results.push({...base,rightsDecision:'unreachable',eligibleForMirror:false,editionNeedsReview:true,error:String(error?.message||error)});}
 });
 results.sort((a,b)=>a.index-b.index);
 const eligible=results.filter(x=>x.eligibleForMirror); const quarantine=results.filter(x=>!x.eligibleForMirror);
 const payload={version:'2026.09.02',engine:'@Rechercher',indexStart:START,indexCount:COUNT,actualCount:rows.length,eligibleCount:eligible.length,quarantineCount:quarantine.length,generatedAt:new Date().toISOString(),policy:'Only explicit reusable rights or a verified public-domain work with no edition barrier may enter the mirroring pipeline. All other records remain discoverable but are excluded/quarantined.'};
 await mkdir(OUT,{recursive:true});
 await writeFile(`${OUT}/results.jsonl`,results.map(x=>JSON.stringify(x)).join('\n')+'\n');
 await writeFile(`${OUT}/eligible-index.jsonl`,eligible.map(x=>JSON.stringify(x)).join('\n')+(eligible.length?'\n':''));
 await writeFile(`${OUT}/quarantine.jsonl`,quarantine.map(x=>JSON.stringify(x)).join('\n')+(quarantine.length?'\n':''));
 payload.sha256=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
 await writeFile(`${OUT}/state.json`,JSON.stringify(payload,null,2)+'\n');
 console.log(JSON.stringify(payload,null,2));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
