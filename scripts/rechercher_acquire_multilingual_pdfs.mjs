#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolveRights, RIGHTS} from '../src/book-rights-resolver.js';

const ROOT=process.cwd();
const ledger=path.join(ROOT,'research/evidence/global-multilingual/scientific-ledger.jsonl');
const sourceRegistry=JSON.parse(await fs.readFile(path.join(ROOT,'config/rechercher/islamic-source-adapters-2026.json'),'utf8'));
const out=path.join(ROOT,'artifacts/rechercher/multilingual-pdf-acquisition');
const languages=new Map();
for (const line of (await fs.readFile(ledger,'utf8')).split(/\r?\n/)) {
  if (!line.trim()) continue;
  const r=JSON.parse(line);
  languages.set(r.language_iso || r.language, {name:r.language, iso:r.language_iso, records:(languages.get(r.language_iso || r.language)?.records||[]).concat(r)});
}
const ALLOWED_ORIGINS=new Set(sourceRegistry.adapters.flatMap(a=>a.origins));
function allowedUrl(value){
  let u;
  try { u=new URL(value); } catch { return null; }
  if (u.protocol!=='https:' || !ALLOWED_ORIGINS.has(u.origin)) return null;
  return u;
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const inspectPdfFile=async file=>{
  const h=createHash('sha256');
  const handle=await fs.open(file,'r');
  try {
    const buf=Buffer.alloc(1024*1024);
    let position=0, total=0;
    let header=null;
    for(;;){
      const {bytesRead}=await handle.read(buf,0,buf.length,position);
      if(!bytesRead) break;
      if(position===0) header=buf.subarray(0,Math.min(4,bytesRead)).toString();
      h.update(buf.subarray(0,bytesRead));
      total+=bytesRead;
      position+=bytesRead;
    }
    return {bytes:total,sha256:h.digest('hex'),isPdf:total>=4 && header==='%PDF'};
  } finally { await handle.close(); }
};
const rightsForRecord=records=>{
  const evidence=[];
  for(const r of records){
    const candidates=[r.rights_evidence,r.rightsEvidence,r.evidence?.rights,r.stages?.flatMap?.(s=>s.evidence?.rights || [])].flat().filter(Boolean);
    for(const e of candidates){
      if(typeof e==='string') evidence.push({source:r.provider||r.source_url||'matrix',kind:e});
      else if(e && typeof e==='object' && e.kind) evidence.push({...e,source:e.source||r.provider||r.source_url||'matrix'});
    }
    if(r.redistribution_allowed===true) evidence.push({source:r.provider||'matrix',kind:'explicit-redistribution-permission'});
    if(r.rights_status==='public-domain') evidence.push({source:r.provider||'matrix',kind:'public-domain'});
    if(r.rights_status==='verified-redistributable') evidence.push({source:r.provider||'matrix',kind:'explicit-redistribution-permission'});
    if(r.rights_status==='restricted') evidence.push({source:r.provider||'matrix',kind:'restricted'});
  }
  // HadeethEnc publishes explicit terms permitting download and republication of its translated content,
  // subject to attribution, version preservation, no modification, source notification, and updates.
  // Apply this evidence only to translation records; Arabic canonical/original material remains review-gated.
  if(records.some(r=>r.provider==='hadeethenc') && !records.some(r=>String(r.language_iso||r.language||'').toLowerCase()==='ar')){
    evidence.push({
      source:'HadeethEnc.com',
      kind:'explicit-redistribution-permission',
      url:'https://hadeethenc.com/ar/',
      conditions:[
        'no-modification-addition-or-deletion',
        'clear-publisher-and-source-attribution',
        'mention-version-number',
        'retain-transcript-information',
        'notify-source-of-translation-notes',
        'update-to-latest-source-version',
        'no-inappropriate-advertising'
      ]
    });
  }
  return resolveRights(evidence);
};
function safe(s){return String(s||'unknown').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()||'unknown'}
function pdfLinks(html,base){
 const out=[],seen=new Set();
 const re=/href=["']([^"']+)["']/gi; let m;
 while((m=re.exec(html))){
   const u=allowedUrl(new URL(m[1],base).href); if(!u) continue;
   if(!/\.pdf(?:\?|$)/i.test(u.pathname+u.search)) continue;
   if(/\.pdf\.enc(?:\?|$)/i.test(u.pathname+u.search)) continue;
   if(!seen.has(u.href)){seen.add(u.href);out.push(u.href)}
 }
 return out;
}
async function get(url){
 const u=allowedUrl(url); if(!u) throw new Error('untrusted or disallowed HTTPS origin');
 for(let i=0;i<4;i++){try{
   const r=await fetch(u,{headers:{'user-agent':'DinAllah-Rechercher/2.0','accept':'text/html,application/pdf;q=0.9,*/*;q=0.1'}});
   if(r.status===429){await sleep(1500*(i+1));continue}
   if(!r.ok) return {status:r.status,bytes:null,contentType:r.headers.get('content-type')};
   return {status:r.status,bytes:Buffer.from(await r.arrayBuffer()),contentType:r.headers.get('content-type')};
 }catch(e){if(i===3) throw e;await sleep(700*(i+1));}}
}
async function probePdf(url){
  const u=allowedUrl(url); if(!u) return null;
  for(let i=0;i<3;i++){try{
    const r=await fetch(u,{method:'HEAD',redirect:'manual',headers:{'user-agent':'DinAllah-Rechercher/2.0','accept':'application/pdf,*/*;q=0.1'}});
    if(r.status===429){await sleep(1000*(i+1));continue}
    return {status:r.status,contentType:r.headers.get('content-type')};
  }catch(e){if(i===2)return null;await sleep(500*(i+1));}}
  return null;
}
function downloadPdf(url,file){
 const u=allowedUrl(url); if(!u) return Promise.reject(new Error('untrusted or disallowed HTTPS origin'));
 const args=['--fail','--silent','--show-error','--location','--proto','=https','--output',file,u.href];
 return new Promise((resolve,reject)=>{
   const p=spawn('curl',args,{stdio:['ignore','ignore','pipe']});
   let err=''; p.stderr.on('data',b=>{err+=b.toString()});
   p.on('error',reject);
   p.on('close',code=>code===0?resolve():reject(new Error(err||'curl failed')));
 });
}
const summary={schema:'rechercher/multilingual-resource-acquisition/v2',generated_at:new Date().toISOString(),language_count:languages.size,policy:{redistribution:'only when explicitly verified',research_only:'only when lawful research access is explicitly established; never public',public_repo:'research-only PDFs are forbidden from persistence in this public repository'},languages:{}};
for(const [key,lang] of languages){
 const rights=rightsForRecord(lang.records);
 const acquisition=rights.status===RIGHTS.REDISTRIBUTABLE?'public':(rights.status===RIGHTS.READ_COPY||rights.status===RIGHTS.READ_ONLY?'research-only':'blocked');
 const entry={language:lang.name,iso:lang.iso,status:'no-eligible-pdf-found',sources_checked:[],files:[],rights:rights.status,rights_conflict:rights.conflict,rights_confidence:rights.confidence,rights_evidence:rights.evidence,acquisition};
 if(acquisition==='blocked'){ entry.status='rights-blocked'; summary.languages[key]=entry; continue; }
 const iso=String(lang.iso||'ar').toLowerCase();
 if(!/^[a-z]{2,3}(?:-[a-z]{2,4})?$/.test(iso)){summary.languages[key]=entry;continue}

 const sourcePages=[];
 const registered=new Map(sourceRegistry.adapters.map(a=>[a.id,a]));
 for(const r of lang.records){
   const id=String(r.provider||r.source_id||'').toLowerCase();
   const adapter=registered.get(id);
   if(adapter && adapter.status==='enabled') sourcePages.push({adapter,url:adapter.base_url});
 }
 for(const adapter of sourceRegistry.adapters){
   if(adapter.status!=='enabled') continue;
   const canProvidePdf=adapter.kinds?.some(k=>['pdf','download','datasets'].includes(k));
   if(!canProvidePdf) continue;
   if(sourcePages.some(x=>x.adapter.id===adapter.id)) continue;
   sourcePages.push({adapter,url:adapter.base_url});
 }

 for(const {adapter,url:sourceUrl} of sourcePages){
   entry.sources_checked.push({source:adapter.id,url:sourceUrl,role:adapter.authority||adapter.source_role||'islamic-source'});
   try{
     const p=await get(sourceUrl);
     if(!p.bytes) continue;
     const links=pdfLinks(p.bytes.toString('utf8'),sourceUrl);
     for(const pdfUrl of links.slice(0,32)){
       const d=await probePdf(pdfUrl);
       if(d && (d.status < 200 || d.status >= 400)) continue;
       if(d?.contentType && !/^application\/pdf(?:\s*;|$)/i.test(d.contentType)) continue;
       const dir=path.join(out,safe(iso),safe(adapter.id)); await fs.mkdir(dir,{recursive:true});
       const parsed=allowedUrl(pdfUrl); if(!parsed) continue;
       const name=safe(path.basename(parsed.pathname)); if(name==='unknown') continue;
       const file=path.join(dir,name);
       const resolved=path.resolve(file);
       if(!resolved.startsWith(path.resolve(dir)+path.sep)) continue;
       await downloadPdf(pdfUrl,resolved);
       const inspected=await inspectPdfFile(resolved);
       if(!inspected.isPdf){
         await fs.rm(resolved,{force:true});
         continue;
       }
       entry.files.push({
         source:adapter.id,
         url:pdfUrl,
         path:path.relative(ROOT,resolved),
         bytes:inspected.bytes,
         sha256:inspected.sha256,
         content_type:d?.contentType||null,
         acquisition,
         rights:rights.status
       });
     }
   }catch(e){
     entry.source_errors ??= [];
     entry.source_errors.push({source:adapter.id,error:String(e.message||e)});
   }
 }
 if(entry.files.length) entry.status=acquisition==='research-only'?'research-only-acquired':'acquired';
 summary.languages[key]=entry;
}
await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({language_count:languages.size,blocked_rights:Object.values(summary.languages).filter(x=>x.status==='rights-blocked').length,acquired_languages:Object.values(summary.languages).filter(x=>x.status==='acquired').length,research_only_acquired:Object.values(summary.languages).filter(x=>x.status==='research-only-acquired').length,total_pdfs:Object.values(summary.languages).reduce((n,x)=>n+x.files.length,0),manifest:path.relative(ROOT,path.join(out,'manifest.json'))}));
