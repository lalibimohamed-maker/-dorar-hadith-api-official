#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';

const ROOT=process.cwd();
const ledgerPath=path.join(ROOT,'research/evidence/global-multilingual/scientific-ledger.jsonl');
const prevManifest=process.env.PREVIOUS_MANIFEST;
const out=path.join(ROOT,'artifacts/rechercher/multilingual-deep-pdf-expansion');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const safe=s=>String(s||'unknown').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()||'unknown';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const rows=(await fs.readFile(ledgerPath,'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
if(rows.length!==3192) throw new Error('Expected 3192 ledger rows');
const old=JSON.parse(await fs.readFile(prevManifest,'utf8'));
const cells=old.cells||{};
const missing=rows.filter(r=>!(cells[r.cell_id]?.files||[]).length);
console.log(`DEEP_EXPANSION_TARGET cells=${missing.length}/3192`);

const routes=[
 {id:'internet_archive',origin:'https://archive.org',url:(r)=>`https://archive.org/advancedsearch.php?q=${encodeURIComponent(`${r.language} Islamic ${r.domain.replaceAll('_',' ')}`)}&fl[]=identifier&fl[]=title&fl[]=description&fl[]=format&fl[]=rights&rows=20&page=1&output=json`},
 {id:'openlibrary',origin:'https://openlibrary.org',url:(r)=>`https://openlibrary.org/search.json?q=${encodeURIComponent(`${r.language} Islamic ${r.domain.replaceAll('_',' ')}`)}&limit=20`},
 {id:'loc',origin:'https://www.loc.gov',url:(r)=>`https://www.loc.gov/books/?q=${encodeURIComponent(`${r.language} Islamic ${r.domain.replaceAll('_',' ')}`)}&fo=json&c=20`},
 {id:'europeana',origin:'https://www.europeana.eu',url:(r)=>`https://www.europeana.eu/api/v2/search.json?query=${encodeURIComponent(`${r.language} Islamic ${r.domain.replaceAll('_',' ')}`)}&rows=20`},
 {id:'dpla',origin:'https://api.dp.la',url:(r)=>`https://api.dp.la/v2/items?q=${encodeURIComponent(`${r.language} Islamic ${r.domain.replaceAll('_',' ')}`)}&page_size=20`}
];
const origins=new Set(routes.map(x=>x.origin));
function allow(raw){try{const u=new URL(raw);return u.protocol==='https:'&&origins.has(u.origin)?u:null}catch{return null}}
async function get(url){
 const u=allow(url); if(!u) return null;
 for(let i=0;i<3;i++){try{
  const res=await fetch(u,{redirect:'follow',headers:{'user-agent':'DinAllah-Rechercher/2.1','accept':'application/json,text/html,application/pdf;q=0.9,*/*;q=0.1'}});
  const b=Buffer.from(await res.arrayBuffer());
  if(res.status===429){await sleep(1200*(i+1));continue}
  return {status:res.status,bytes:b,contentType:res.headers.get('content-type')||'',finalUrl:res.url};
 }catch(e){if(i===2)return null;await sleep(700*(i+1))}}
}
function links(text,base){
 const out=[],seen=new Set(),re=/https?:\\/\\/[^\\s"'<>]+|href=["']([^"']+)["']/gi; let m;
 while((m=re.exec(text))){
  const raw=m[1]||m[0]; let u; try{u=new URL(raw,base)}catch{continue}
  if(u.protocol!=='https:'||!/\\.pdf(?:[?#]|$)/i.test(u.href)||seen.has(u.href))continue;
  seen.add(u.href);out.push(u.href);
 } return out;
}
function explicitRights(text){
 return /public domain|creative commons|cc[- ]by|cc0|open access|free download|publicly available|redistribut/i.test(text);
}
function curl(url,file){return new Promise((resolve,reject)=>{const p=spawn('curl',['--fail','--silent','--show-error','--location','--proto','=https','--output',file,url],{stdio:['ignore','ignore','pipe']});let e='';p.stderr.on('data',x=>e+=x);p.on('error',reject);p.on('close',c=>c===0?resolve():reject(new Error(e||'curl failed')))});}
const result={schema:'rechercher/multilingual-deep-pdf-expansion/v1',generated_at:new Date().toISOString(),input_cells:missing.length,attempted_cells:0,total_files:0,public_files:0,research_only_files:0,cells:{}};
await fs.mkdir(out,{recursive:true});
for(const r of missing){
 const e={cell_id:r.cell_id,language:r.language,language_iso:r.language_iso||null,domain:r.domain,status:'no-pdf-found',sources_checked:[],files:[],policy:'deep discovery; no canonical corpus writes'};
 for(const route of routes){
  if(e.files.length>=2) break;
  const target=route.url(r); e.sources_checked.push({source:route.id,url:target});
  const page=await get(target); if(!page||!page.bytes) continue;
  const text=page.bytes.toString('utf8');
  const candidates=links(text,page.finalUrl||target);
  for(const pdfUrl of candidates.slice(0,12)){
   if(e.files.length>=2) break;
   const dir=path.join(out,safe(r.language_iso||r.language),safe(r.domain),safe(route.id));
   await fs.mkdir(dir,{recursive:true});
   const name=safe(path.basename(new URL(pdfUrl).pathname))||safe(r.cell_id)+'.pdf';
   const file=path.join(dir,name.endsWith('.pdf')?name:name+'.pdf');
   try{
    await curl(pdfUrl,file);
    const b=await fs.readFile(file);
    if(b.subarray(0,4).toString()!=='%PDF'){await fs.rm(file,{force:true});continue}
    const rights=explicitRights(text);
    const acquisition=rights?'public':'research-only';
    e.files.push({cell_id:r.cell_id,source:route.id,url:pdfUrl,path:path.relative(ROOT,file),bytes:b.length,sha256:sha256(b),acquisition,rights:rights?'explicit-source-marker':'review-required',language_iso:r.language_iso||null,domain:r.domain});
   }catch{await fs.rm(file,{force:true})}
  }
 }
 if(e.files.length)e.status='acquired';
 result.cells[r.cell_id]=e; result.attempted_cells++;
 result.total_files+=e.files.length;
 result.public_files+=e.files.filter(x=>x.acquisition==='public').length;
 result.research_only_files+=e.files.filter(x=>x.acquisition==='research-only').length;
 if(result.attempted_cells%25===0)console.log(`DEEP_EXPANSION_PROGRESS completed=${result.attempted_cells}/${missing.length} files=${result.total_files}`);
}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(result,null,2)+'\\n');
console.log(JSON.stringify({input_cells:result.input_cells,attempted_cells:result.attempted_cells,total_files:result.total_files,public_files:result.public_files,research_only_files:result.research_only_files}));
