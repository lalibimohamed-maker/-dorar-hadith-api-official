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
const rows=(await fs.readFile(ledger,'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const EXPECTED_CELLS=3192;
const cells=new Map();
for(const r of rows){
  if(!r.cell_id) throw new Error('Scientific ledger row is missing cell_id');
  if(cells.has(r.cell_id)) throw new Error(`Duplicate scientific ledger cell: ${r.cell_id}`);
  cells.set(r.cell_id,r);
}
if(cells.size!==EXPECTED_CELLS) throw new Error(`Scientific ledger must contain ${EXPECTED_CELLS} unique cells; found ${cells.size}`);

const adapters=new Map(sourceRegistry.adapters.map(a=>[a.id,a]));
const ALLOWED_ORIGINS=new Set(sourceRegistry.adapters.flatMap(a=>a.origins));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function allowedUrl(value){let u;try{u=new URL(value)}catch{return null}if(u.protocol!=='https:'||!ALLOWED_ORIGINS.has(u.origin))return null;return u}
function safe(s){return String(s||'unknown').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()||'unknown'}
const inspectPdfFile=async file=>{const h=createHash('sha256');const handle=await fs.open(file,'r');try{const buf=Buffer.alloc(1024*1024);let position=0,total=0,header=null;for(;;){const {bytesRead}=await handle.read(buf,0,buf.length,position);if(!bytesRead)break;if(position===0)header=buf.subarray(0,Math.min(4,bytesRead)).toString();h.update(buf.subarray(0,bytesRead));total+=bytesRead;position+=bytesRead}return{bytes:total,sha256:h.digest('hex'),isPdf:total>=4&&header==='%PDF'}}finally{await handle.close()}};
function rightsForCell(r){
  const evidence=[];
  for(const s of r.stages||[]) if(s.evidence?.url) evidence.push({source:r.provider||'matrix',kind:'observed-source',url:s.evidence.url});
  const rs=(r.stages||[]).find(s=>s.stage==='rights');
  if(rs?.rights_status==='known-terms') evidence.push({source:r.provider||'matrix',kind:'explicit-redistribution-permission',url:rs.evidence?.url||null});
  return resolveRights(evidence);
}
function pdfLinks(html,base){
  const found=[],seen=new Set(),re=/href=["']([^"']+)["']/gi;let m;
  while((m=re.exec(html))){
    let u;try{u=allowedUrl(new URL(m[1],base).href)}catch{u=null}
    if(!u)continue;
    if(!/\.pdf(?:\?|$)/i.test(u.pathname+u.search)||/\.pdf\.enc(?:\?|$)/i.test(u.pathname+u.search))continue;
    if(!seen.has(u.href)){seen.add(u.href);found.push(u.href)}
  }
  return found;
}
async function get(url){
  const u=allowedUrl(url);if(!u)throw new Error('untrusted or disallowed HTTPS origin');
  for(let i=0;i<4;i++)try{
    const r=await fetch(u,{redirect:'follow',headers:{'user-agent':'DinAllah-Rechercher/2.0','accept':'text/html,application/pdf;q=0.9,*/*;q=0.1'}});
    if(r.status===429){await sleep(1500*(i+1));continue}
    if(!r.ok)return{status:r.status,bytes:null,contentType:r.headers.get('content-type'),finalUrl:r.url};
    return{status:r.status,bytes:Buffer.from(await r.arrayBuffer()),contentType:r.headers.get('content-type'),finalUrl:r.url};
  }catch(e){if(i===3)throw e;await sleep(700*(i+1))}
}
async function probePdf(url){
  const u=allowedUrl(url);if(!u)return null;
  for(let i=0;i<3;i++)try{
    const r=await fetch(u,{method:'HEAD',redirect:'follow',headers:{'user-agent':'DinAllah-Rechercher/2.0','accept':'application/pdf,*/*;q=0.1'}});
    if(r.status===429){await sleep(1000*(i+1));continue}
    return{status:r.status,contentType:r.headers.get('content-type'),finalUrl:r.url};
  }catch(e){if(i===2)return null;await sleep(500*(i+1))}
  return null;
}
function downloadPdf(url,file){
  const u=allowedUrl(url);if(!u)return Promise.reject(new Error('untrusted or disallowed HTTPS origin'));
  return new Promise((resolve,reject)=>{
    const p=spawn('curl',['--fail','--silent','--show-error','--location','--proto','=https','--output',file,u.href],{stdio:['ignore','ignore','pipe']});
    let err='';p.stderr.on('data',b=>err+=b.toString());p.on('error',reject);p.on('close',code=>code===0?resolve():reject(new Error(err||'curl failed')));
  });
}

const manifest={
  schema:'rechercher/multilingual-resource-acquisition/v3',
  generated_at:new Date().toISOString(),
  language_count:new Set(rows.map(r=>r.language_iso||r.language)).size,
  cell_count:cells.size,total_files:0,total_public_files:0,total_research_only_files:0,
  policy:{redistribution:'only when explicitly verified',research_only:'never persisted to public matrix storage',canonical_arabic_separate:true,no_new_pdf_enc:true},
  cells:{}
};
const downloadedUrls=new Set();let processed=0;

// Language URL Index: derive localized URL variants from the 133 language entries
// already present in the scientific ledger. This is discovery-only; it never
// changes the canonical religious text or translation content.
const LANGUAGE_URL_INDEX=new Map();
for(const row of rows){
  const iso=String(row.language_iso||'').trim().toLowerCase();
  const name=String(row.language||'').trim().toLowerCase();
  if(!iso) continue;
  const aliases=new Set([iso]);
  if(iso.includes('-')) aliases.add(iso.split('-')[0]);
  if(name) aliases.add(name);
  LANGUAGE_URL_INDEX.set(iso,[...aliases].filter(Boolean));
}
function localizedUrlCandidates(rawUrl, languageIso){
  const u=allowedUrl(rawUrl);
  if(!u) return [];
  const aliases=LANGUAGE_URL_INDEX.get(String(languageIso||'').toLowerCase())||[String(languageIso||'').toLowerCase()];
  const out=[];
  const seen=new Set();
  const add=value=>{
    const v=allowedUrl(value);
    if(v && !seen.has(v.href)){seen.add(v.href);out.push(v.href)}
  };
  // 1) Existing language/locale query parameters.
  for(const key of ['lang','language','locale','hl','lng']){
    const q=new URL(u.href);
    q.searchParams.set(key,aliases[0]);
    add(q.href);
  }
  // 2) Replace a known locale-like path segment.
  const parts=u.pathname.split('/').filter(Boolean);
  for(let i=0;i<parts.length;i++){
    if(/^[a-z]{2,3}(?:-[a-z]{2})?$/i.test(parts[i]) || /^(?:ar|en|fr|de|es|pt|it|nl|tr|ur|fa|id|ms|bn|hi|ru|zh|ja|ko)$/i.test(parts[i])){
      for(const alias of aliases){
        const p=[...parts];p[i]=alias;
        const q=new URL(u.href);q.pathname='/'+p.join('/')+(u.pathname.endsWith('/')?'/':'');add(q.href);
      }
    }
  }
  // 3) Common localized-prefix forms used by multilingual Islamic sites.
  for(const alias of aliases){
    const q=new URL(u.href);
    q.pathname='/'+alias+'/'+u.pathname.replace(/^\/+/, '');
    add(q.href);
  }
  return out;
}
for(const [cellId,r] of cells){
  const rights=rightsForCell(r);
  const acquisition=rights.status===RIGHTS.REDISTRIBUTABLE?'public':(rights.status===RIGHTS.READ_COPY||rights.status===RIGHTS.READ_ONLY?'research-only':'blocked');
  const primaryId=String(r.provider||'').toLowerCase();
  const orderedAdapters=[
    ...(adapters.has(primaryId)?[adapters.get(primaryId)]:[]),
    ...[...adapters.values()].filter(a=>a.status==='enabled'&&a.id!==primaryId&&Array.isArray(a.kinds)&&a.kinds.some(k=>['pdf','downloads','books'].includes(k)))
  ];
  if(!orderedAdapters.length)throw new Error('No enabled PDF-capable source adapters for '+cellId);
  const entry={
    cell_id:cellId,language:r.language,language_iso:r.language_iso||null,domain:r.domain,provider:primaryId||orderedAdapters[0].id,
    status:acquisition==='blocked'?'rights-blocked':'no-eligible-pdf-found',sources_checked:[],evidence_urls:[],files:[],
    rights:rights.status,rights_conflict:rights.conflict,rights_confidence:rights.confidence,rights_evidence:rights.evidence,acquisition,
    fallback_attempts:orderedAdapters.map(a=>a.id)
  };
  const evidenceUrls=new Set();
  for(const s of r.stages||[]){
    if(s.evidence?.url)evidenceUrls.add(s.evidence.url);
    for(const u of s.evidence?.evidence_urls||[])evidenceUrls.add(u);
  }
  for(const adapter of orderedAdapters){
    if(entry.files.length>=2)break;
    const candidates=new Set();
    // Prefer language-indexed variants before the canonical/base URL.
    const seedUrls=[adapter.base_url,...evidenceUrls];
    for(const seed of seedUrls){
      const parsed=allowedUrl(seed);
      if(!parsed || !ALLOWED_ORIGINS.has(parsed.origin)) continue;
      for(const variant of localizedUrlCandidates(parsed.href,r.language_iso||r.language)) candidates.add(variant);
      candidates.add(parsed.href);
    }
    for(const url of [...candidates].slice(0,12)){
      if(entry.files.length>=2)break;
      const u=allowedUrl(url);if(!u)continue;
      entry.sources_checked.push({source:adapter.id,url:u.href,role:adapter.id===primaryId?'primary-cell-evidence':'fallback-source'});
      entry.evidence_urls.push(u.href);
      try{
        const p=await get(u.href);if(!p.bytes)continue;
        const ct=p.contentType||'';
        let pdfCandidates=[];
        if(/^application\/pdf(?:\s*;|$)/i.test(ct)||/^%PDF/.test(p.bytes.subarray(0,4).toString()))pdfCandidates=[p.finalUrl||u.href];
        else pdfCandidates=pdfLinks(p.bytes.toString('utf8'),p.finalUrl||u.href);
        for(const pdfUrl of pdfCandidates.slice(0,8)){
          if(entry.files.length>=2||downloadedUrls.has(pdfUrl))continue;
          const d=await probePdf(pdfUrl);
          if(d&&(d.status<200||d.status>=400))continue;
          if(d?.contentType&&!/^application\/pdf(?:\s*;|$)/i.test(d.contentType))continue;
          const dir=path.join(out,safe(String(r.language_iso||r.language)),safe(String(r.domain)),safe(adapter.id));
          await fs.mkdir(dir,{recursive:true});
          const parsed=allowedUrl(pdfUrl);if(!parsed)continue;
          let name=safe(path.basename(parsed.pathname));if(name==='unknown')name=cellId.replace(/[^a-zA-Z0-9._-]+/g,'-')+'.pdf';
          if(!name.endsWith('.pdf'))name+='.pdf';
          const file=path.join(dir,name);
          await downloadPdf(pdfUrl,file);
          const inspected=await inspectPdfFile(file);
          if(!inspected.isPdf){await fs.rm(file,{force:true});continue}
          downloadedUrls.add(pdfUrl);
          entry.files.push({cell_id:cellId,source:adapter.id,url:pdfUrl,path:path.relative(ROOT,file),bytes:inspected.bytes,sha256:inspected.sha256,content_type:d?.contentType||ct||null,acquisition,rights:rights.status,domain:r.domain,language_iso:r.language_iso||null});
        }
      }catch(e){
        entry.source_errors??=[];entry.source_errors.push({source:adapter.id,url:u.href,error:String(e.message||e)});
      }
    }
  }
  if(entry.files.length)entry.status=acquisition==='research-only'?'research-only-acquired':'acquired';
  manifest.cells[cellId]=entry;
  manifest.total_files+=entry.files.length;
  if(acquisition==='public')manifest.total_public_files+=entry.files.length;
  if(acquisition==='research-only')manifest.total_research_only_files+=entry.files.length;
  processed++;
  if(processed%25===0)console.log(`ACQUISITION_PROGRESS completed=${processed}/${cells.size} files=${manifest.total_files}`);
}
await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({cell_count:manifest.cell_count,language_count:manifest.language_count,total_files:manifest.total_files,total_public_files:manifest.total_public_files,total_research_only_files:manifest.total_research_only_files,manifest:path.relative(ROOT,path.join(out,'manifest.json'))}));
