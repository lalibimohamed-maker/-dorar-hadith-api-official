#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const ledger=path.join(ROOT,'research/evidence/global-multilingual/scientific-ledger.jsonl');
const out=path.join(ROOT,'artifacts/rechercher/multilingual-pdf-acquisition');
const languages=new Map();
for (const line of (await fs.readFile(ledger,'utf8')).split(/\r?\n/)) {
  if (!line.trim()) continue;
  const r=JSON.parse(line);
  languages.set(r.language_iso || r.language, {name:r.language, iso:r.language_iso, records:(languages.get(r.language_iso || r.language)?.records||[]).concat(r)});
}
const allow=new Set(['https://hadeethenc.com']);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const sha=async p=>crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex');
function safe(s){return String(s||'unknown').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()||'unknown'}
function pdfLinks(html,base){
 const out=[],seen=new Set();
 const re=/href=["']([^"']+)["']/gi; let m;
 while((m=re.exec(html))){
   const u=new URL(m[1],base); if(!allow.has(u.origin)) continue;
   if(!/\.pdf(?:\?|$)/i.test(u.pathname+u.search)) continue;
   if(/\.pdf\.enc(?:\?|$)/i.test(u.pathname+u.search)) continue;
   if(!seen.has(u.href)){seen.add(u.href);out.push(u.href)}
 }
 return out;
}
async function get(url){
 const u=new URL(url); if(!allow.has(u.origin)) throw new Error('untrusted origin '+u.origin);
 for(let i=0;i<4;i++){try{
   const r=await fetch(u,{headers:{'user-agent':'DinAllah-Rechercher/2.0','accept':'text/html,application/pdf;q=0.9,*/*;q=0.1'}});
   if(r.status===429){await sleep(1500*(i+1));continue}
   if(!r.ok) return {status:r.status,bytes:null,contentType:r.headers.get('content-type')};
   return {status:r.status,bytes:Buffer.from(await r.arrayBuffer()),contentType:r.headers.get('content-type')};
 }catch(e){if(i===3) throw e;await sleep(700*(i+1));}}
}
const summary={schema:'rechercher/multilingual-pdf-acquisition/v1',generated_at:new Date().toISOString(),language_count:languages.size,rights_policy:'download only where source terms explicitly permit redistribution',languages:{}};
for(const [key,lang] of languages){
 const entry={language:lang.name,iso:lang.iso,status:'no-eligible-pdf-found',sources_checked:[],files:[],rights:'review-required'};
 const hasH=lang.records.some(r=>r.provider==='hadeethenc' || r.stages?.some(s=>s.evidence?.url?.includes('hadeethenc.com')));
 if(!hasH){summary.languages[key]=entry;continue}
 entry.rights='source-terms-permit-download-and-republication';
 const page='https://hadeethenc.com/'+(lang.iso||'ar');
 entry.sources_checked.push(page);
 try{
   const p=await get(page); if(p.bytes){
     const links=pdfLinks(p.bytes.toString('utf8'),page);
     for(const url of links.slice(0,32)){
       const d=await get(url); if(!d.bytes) continue;
       if(d.bytes.subarray(0,4).toString()!=='%PDF') continue;
       const dir=path.join(out,safe(lang.iso||lang.name)); await fs.mkdir(dir,{recursive:true});
       const name=safe(path.basename(new URL(url).pathname)); const file=path.join(dir,name);
       await fs.writeFile(file,d.bytes);
       entry.files.push({url,path:path.relative(ROOT,file),bytes:d.bytes.length,sha256:await sha(file),content_type:d.contentType});
     }
   }
 }catch(e){entry.error=String(e.message||e)}
 if(entry.files.length) entry.status='acquired';
 summary.languages[key]=entry;
}
await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({language_count:languages.size,acquired_languages:Object.values(summary.languages).filter(x=>x.status==='acquired').length,total_pdfs:Object.values(summary.languages).reduce((n,x)=>n+x.files.length,0),manifest:path.relative(ROOT,path.join(out,'manifest.json'))}));
