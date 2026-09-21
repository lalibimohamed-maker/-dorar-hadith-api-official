#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {resolveRights, RIGHTS} from '../src/book-rights-resolver.js';

const ROOT=process.cwd();
const LEDGER=path.join(ROOT,'research/evidence/global-multilingual/scientific-ledger.jsonl');
const ADAPTERS=JSON.parse(await fs.readFile(path.join(ROOT,'config/rechercher/islamic-source-adapters-2026.json'),'utf8'));
const MASTER=JSON.parse(await fs.readFile(path.join(ROOT,'books-batches/salaf-01-400h/master-global-source-registry-seed-2026-09.json'),'utf8'));
const OUT=path.join(ROOT,'artifacts/rechercher/multilingual-pdf-acquisition');
const EXPECTED=3192;
const CONCURRENCY=Math.max(1,Math.min(12,Number(process.env.ACQUISITION_CONCURRENCY||8)));
const MAX_FILES=Math.max(1,Math.min(8,Number(process.env.ACQUISITION_MAX_FILES_PER_CELL||4)));
const REQUEST_TIMEOUT=15000, DOWNLOAD_TIMEOUT=90000, RESPONSE_LIMIT=12*1024*1024, PDF_LIMIT=750*1024*1024;

const rows=(await fs.readFile(LEDGER,'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const cells=new Map();
for(const row of rows){
  if(!row.cell_id) throw new Error('missing cell_id');
  if(cells.has(row.cell_id)) throw new Error('duplicate cell '+row.cell_id);
  cells.set(row.cell_id,row);
}
if(cells.size!==EXPECTED) throw new Error('expected '+EXPECTED+' cells, found '+cells.size);

const adapters=new Map(ADAPTERS.adapters.map(x=>[x.id,x]));
const master=new Map((MASTER.sources||[]).map(x=>[x.id,x]));
const origins=new Set(), originSource=new Map();
function addOrigin(id,value){
  try{
    const u=new URL(value);
    if(u.protocol!=='https:'||u.username||u.password) return;
    const host=u.hostname.toLowerCase();
    if(host==='google.com'||host.endsWith('.google.com')) return;
    origins.add(u.origin);
    if(!originSource.has(u.origin)) originSource.set(u.origin,id);
  }catch{}
}
for(const a of adapters.values()){
  for(const o of a.origins||[]) addOrigin(a.id,o);
  addOrigin(a.id,a.base_url);
  addOrigin(a.id,a.api_base_url);
}
for(const s of master.values()) addOrigin(s.id,s.url);
function sourceOf(url){try{return originSource.get(new URL(url).origin)||null;}catch{return null;}}
function allow(url){try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&origins.has(u.origin)?u:null;}catch{return null;}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const safe=s=>String(s||'unknown').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()||'unknown';

async function fetchBytes(url,timeout=REQUEST_TIMEOUT,max=RESPONSE_LIMIT){
  const u=allow(url); if(!u) throw new Error('untrusted source');
  for(let attempt=0;attempt<3;attempt++){
    const ctl=new AbortController(), timer=setTimeout(()=>ctl.abort(),timeout);
    try{
      const r=await fetch(u.href,{redirect:'follow',signal:ctl.signal,headers:{
        'user-agent':'DinAllah-Rechercher/4.0',
        accept:'application/json,text/html,application/pdf,*/*;q=0.1'
      }});
      if(!allow(r.url||u.href)) throw new Error('untrusted redirect');
      if(r.status===429||r.status>=500){await sleep(500*(attempt+1));continue;}
      if(!r.ok) return {bytes:null,status:r.status,contentType:r.headers.get('content-type')||'',finalUrl:r.url||u.href};
      const n=Number(r.headers.get('content-length')||0);
      if(n>max) throw new Error('response too large');
      const bytes=Buffer.from(await r.arrayBuffer());
      if(bytes.length>max) throw new Error('response too large');
      return {bytes,contentType:r.headers.get('content-type')||'',finalUrl:r.url||u.href};
    }catch(e){
      if(attempt===2) throw e;
      await sleep(400*(attempt+1));
    }finally{clearTimeout(timer);}
  }
  throw new Error('request failed');
}

function addUrl(value,base,set){
  if(typeof value!=='string') return;
  const vals=[];
  try{vals.push(new URL(value.trim(),base).href);}catch{}
  for(const x of value.match(/https:\/\/[^\s"'<>]+/g)||[]) vals.push(x);
  for(const x of vals){const u=allow(x);if(u)set.add(u.href);}
}
function deepUrls(v,base,set,d=0){
  if(d>7||v==null) return;
  if(typeof v==='string'){addUrl(v,base,set);return;}
  if(Array.isArray(v)){for(const x of v.slice(0,500)) deepUrls(x,base,set,d+1);return;}
  if(typeof v==='object'){
    for(const [k,x] of Object.entries(v).slice(0,500)){
      if(/url|uri|href|link|download|file|pdf|location/i.test(k)||d<3) deepUrls(x,base,set,d+1);
    }
  }
}
function htmlUrls(text,base,set){
  const re=/(?:href|src|data-url|data-href|data-download|data-pdf)\s*=\s*["']([^"']+)["']/gi;let m;
  while((m=re.exec(text))!==null)addUrl(m[1],base,set);
}
function isPdfUrl(url){try{const u=new URL(url);return /\.pdf$/i.test(u.pathname)||/format=pdf/i.test(u.search)||/\.pdf\?/i.test(u.href);}catch{return false;}}

async function archivePdfUrls(json){
  const ids=new Set(),out=new Set();
  const scan=v=>{
    if(!v||typeof v!=='object') return;
    if(Array.isArray(v)){for(const x of v.slice(0,300))scan(x);return;}
    if(typeof v.identifier==='string') ids.add(v.identifier);
    if(Array.isArray(v.docs)) for(const x of v.docs.slice(0,100)) scan(x);
    if(Array.isArray(v.files)&&v.identifier){
      for(const f of v.files.slice(0,500)){
        const n=String(f?.name||''),fmt=String(f?.format||'');
        if((/\.pdf$/i.test(n)||/pdf/i.test(fmt))&&!n.includes('/')) out.add('https://archive.org/download/'+encodeURIComponent(v.identifier)+'/'+encodeURIComponent(n));
      }
    }
  };
  scan(json);
  for(const id of ids){
    try{
      const r=await fetchBytes('https://archive.org/metadata/'+encodeURIComponent(id));
      if(r.bytes) scan(JSON.parse(r.bytes.toString('utf8')));
    }catch{}
  }
  return [...out];
}

async function candidateUrls(seed){
  if(candidateCache.has(seed)) return candidateCache.get(seed);
  const pending=(async()=>{const r=await fetchBytes(seed);
  if(!r.bytes) return [];
  if(isPdfUrl(r.finalUrl)||/^application\/pdf/i.test(r.contentType)) return [r.finalUrl];
  const set=new Set(), text=r.bytes.toString('utf8');
  try{
    const json=JSON.parse(text);
    deepUrls(json,r.finalUrl,set);
    if(new URL(r.finalUrl).origin==='https://archive.org') for(const u of await archivePdfUrls(json)) set.add(u);
  }catch{htmlUrls(text,r.finalUrl,set);}
  return [...set].filter(x=>allow(x)).slice(0,16);
  })();
  candidateCache.set(seed,pending);
  try{return await pending;}catch(e){candidateCache.delete(seed);throw e;}
}

function evidenceUrls(row){
  const set=new Set(),add=v=>{if(typeof v==='string')addUrl(v,'https://invalid.example/',set);};
  add(row.source_url);
  for(const u of row.evidence_urls||[]) add(u);
  for(const s of row.stages||[]){
    add(s?.evidence?.url);
    for(const u of s?.evidence?.evidence_urls||[]) add(u);
    for(const u of s?.provenance?.evidence_urls||[]) add(u);
    add(s?.rights_evidence?.source_url);
  }
  return [...set];
}
function rightsFor(row){
  const e=[],fallback=row.provider||sourceOf(row.source_url||'')||'matrix';
  const push=x=>{if(typeof x==='string')e.push({source:fallback,kind:x});else if(x&&x.kind)e.push({...x,source:x.source||fallback});};
  for(const x of [row.rights_evidence,row.rightsEvidence,row.evidence?.rights]){
    if(Array.isArray(x)) for(const i of x) push(i); else push(x);
  }
  for(const s of row.stages||[]){
    if(Array.isArray(s?.rights_evidence)) for(const i of s.rights_evidence) push(i); else push(s?.rights_evidence);
    if(s?.rights_status) push({kind:String(s.rights_status)});
    if(s?.redistribution_allowed===true) push({kind:'explicit-redistribution-permission'});
  }
  if(row.redistribution_allowed===true) push({kind:'explicit-redistribution-permission'});
  if(row.rights_status==='public-domain') push({kind:'public-domain'});
  if(row.rights_status==='verified-redistributable') push({kind:'explicit-redistribution-permission'});
  if(row.rights_status==='restricted') push({kind:'restricted'});
  if(row.provider==='hadeethenc'&&String(row.language_iso||row.language||'').toLowerCase()!=='ar'){
    e.push({source:'HadeethEnc.com',kind:'explicit-redistribution-permission',url:'https://hadeethenc.com/ar/'});
  }
  return resolveRights(e);
}
function acquisitionType(r){
  if(r.status===RIGHTS.REDISTRIBUTABLE&&!r.conflict) return 'public';
  if(r.status===RIGHTS.READ_COPY||r.status===RIGHTS.READ_ONLY) return 'research-only';
  return 'blocked';
}
function apiSeeds(adapter,row){
  if(!adapter?.api_base_url||!row.language_iso) return [];
  const result=[];
  for(const [name,t] of Object.entries(adapter.api_endpoints||{})){
    if(!/books|downloads|items|category_items/i.test(name)||!/\{language\}/.test(t)) continue;
    const p=t.replaceAll('{language}',encodeURIComponent(String(row.language_iso).toLowerCase())).replaceAll('{sourceLanguage}','ar').replaceAll('{page}','1').replaceAll('{perPage}','100').replaceAll('{categoryId}','1').replaceAll('{type}','books');
    const u=adapter.api_base_url.replace(/\/$/,'')+p;if(allow(u)) result.push(u);
  }
  return [...new Set(result)];
}

const manifest={
  schema:'rechercher/multilingual-resource-acquisition/v4',
  generated_at:new Date().toISOString(),
  language_count:new Set([...cells.values()].map(r=>r.language_iso||r.language)).size,
  cell_count:cells.size,total_files:0,total_public_files:0,total_research_only_files:0,total_blocked_cells:0,
  concurrency:CONCURRENCY,
  policy:{
    redistribution:'only when explicitly verified',
    research_only:'only explicit read-copy/read-only evidence; never public',
    rights_unclear:'metadata preserved; no file publication or mirroring',
    discovery_is_not_permission:true,canonical_arabic_separate:true,machine_translation_never_promoted:true,
    no_new_pdf_enc:true,corpus_write:false
  },
  source_counts:{},cells:{}
};
const claimed=new Set(),candidateCache=new Map(),started=Date.now();

async function downloadPdf(url,dest){
  const u=allow(url);if(!u)throw new Error('untrusted PDF');
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),DOWNLOAD_TIMEOUT),part=dest+'.part';
  try{
    const r=await fetch(u.href,{redirect:'follow',signal:ctl.signal,headers:{'user-agent':'DinAllah-Rechercher/4.0',accept:'application/pdf,*/*;q=0.1'}});
    if(!allow(r.url||u.href)) throw new Error('untrusted PDF redirect');
    if(!r.ok) throw new Error('HTTP '+r.status);
    await fs.mkdir(path.dirname(dest),{recursive:true});
    const h=await fs.open(part,'w'),hash=createHash('sha256');let total=0,header='';
    try{
      for await(const chunk of r.body){
        const b=Buffer.from(chunk);if(!header)header=b.subarray(0,4).toString();total+=b.length;
        if(total>PDF_LIMIT) throw new Error('PDF exceeds size limit');
        hash.update(b);await h.write(b);
      }
    }finally{await h.close();}
    if(header!=='%PDF'){await fs.rm(part,{force:true});throw new Error('not a PDF');}
    const sha256=hash.digest('hex');await fs.rename(part,dest);
    return {bytes:total,sha256,finalUrl:r.url||u.href,contentType:r.headers.get('content-type')||''};
  }catch(e){await fs.rm(part,{force:true});throw e;}finally{clearTimeout(timer);}
}

async function processCell(row){
  const urls=evidenceUrls(row),rights=rightsFor(row),type=acquisitionType(rights);
  const entry={
    cell_id:row.cell_id,language:row.language,language_iso:row.language_iso||null,domain:row.domain,
    provider:row.provider||sourceOf(urls[0]||''),status:type==='blocked'?'rights-blocked':'no-eligible-pdf-found',
    sources_checked:[],evidence_urls:urls,files:[],rights:rights.status,rights_conflict:rights.conflict,
    rights_confidence:rights.confidence,rights_evidence:rights.evidence,acquisition:type,source_errors:[]
  };
  if(type==='blocked'){manifest.total_blocked_cells++;manifest.cells[row.cell_id]=entry;return;}
  const ids=[],push=id=>{if(id&&!ids.includes(id))ids.push(id)};
  if(row.provider&&(adapters.has(row.provider)||master.has(row.provider)))push(row.provider);
  for(const u of urls) push(sourceOf(u));
  for(const a of adapters.values()) if(a.status==='enabled'&&a.kinds?.some(k=>['pdf','downloads','download','datasets'].includes(k))) push(a.id);
  const seeds=[];
  for(const id of ids.slice(0,8)){
    const a=adapters.get(id);
    for(const u of urls.filter(x=>sourceOf(x)===id)) seeds.push({id,url:u,role:'cell-evidence'});
    if(a){const direct=urls.some(x=>sourceOf(x)===id);if(!direct&&a.base_url)seeds.push({id,url:a.base_url,role:'adapter-base'});for(const u of apiSeeds(a,row))seeds.push({id,url:u,role:'official-api'});}
  }
  const localSeen=new Set();
  for(const seed of seeds){
    if(entry.files.length>=MAX_FILES||localSeen.has(seed.url)||!allow(seed.url)) break;
    localSeen.add(seed.url);
    entry.sources_checked.push({source:seed.id,url:seed.url,role:seed.role});
    let candidates=[];
    try{candidates=await candidateUrls(seed.url);}catch(e){entry.source_errors.push({source:seed.id,url:seed.url,error:String(e.message||e)});continue;}
    for(const candidate of candidates){
      if(entry.files.length>=MAX_FILES||!isPdfUrl(candidate)) continue;
      const pdf=allow(candidate)?.href;if(!pdf||claimed.has(pdf)) continue;
      claimed.add(pdf);
      const sourceId=sourceOf(pdf)||seed.id;
      const dir=path.join(OUT,safe(row.language_iso||row.language),safe(row.domain),safe(sourceId));
      const temp=path.join(dir,safe(row.cell_id)+'-'+createHash('sha1').update(pdf).digest('hex').slice(0,12)+'.pdf');
      try{
        const r=await downloadPdf(pdf,temp),base=safe(path.basename(new URL(r.finalUrl).pathname))||'document.pdf';
        const final=path.join(dir,safe(row.cell_id)+'__'+r.sha256.slice(0,16)+'__'+(base.endsWith('.pdf')?base:base+'.pdf'));
        await fs.rename(temp,final);
        entry.files.push({
          cell_id:row.cell_id,source:sourceId,discovered_from:seed.url,url:r.finalUrl,path:path.relative(ROOT,final),
          bytes:r.bytes,sha256:r.sha256,content_type:r.contentType,acquisition:type,rights:rights.status,
          domain:row.domain,language_iso:row.language_iso||null,provenance:seed.id+':'+seed.url,promoteToCorpus:false
        });
        manifest.total_files++;
        if(type==='public')manifest.total_public_files++;
        if(type==='research-only')manifest.total_research_only_files++;
        manifest.source_counts[sourceId]=(manifest.source_counts[sourceId]||0)+1;
      }catch(e){claimed.delete(pdf);entry.source_errors.push({source:seed.id,url:pdf,error:String(e.message||e)});}
    }
  }
  if(entry.files.length) entry.status=type==='research-only'?'research-only-acquired':'acquired';
  manifest.cells[row.cell_id]=entry;
}

const list=[...cells.values()];let next=0,done=0;
async function worker(){
  while(true){
    const i=next++;if(i>=list.length)return;const row=list[i];
    try{await processCell(row);}catch(e){
      manifest.cells[row.cell_id]={cell_id:row.cell_id,language:row.language,language_iso:row.language_iso||null,domain:row.domain,
        provider:row.provider||null,status:'acquisition-error',sources_checked:[],evidence_urls:evidenceUrls(row),files:[],
        rights:'rights-unclear',rights_conflict:false,rights_confidence:0,rights_evidence:[],
        acquisition:'blocked',source_errors:[{source:row.provider||'matrix',error:String(e.message||e)}]};
      manifest.total_blocked_cells++;
    }
    done++;
    if(done%25===0||done===list.length){
      const elapsed=(Date.now()-started)/1000,rate=done/Math.max(elapsed,.001);
      console.log('ACQUISITION_PROGRESS completed='+done+'/'+list.length+' files='+manifest.total_files+' rate='+rate.toFixed(2)+'cells/s');
    }
  }
}
console.log('ACQUISITION_START cells='+list.length+' concurrency='+CONCURRENCY+' requestTimeoutMs='+REQUEST_TIMEOUT+' downloadTimeoutMs='+DOWNLOAD_TIMEOUT);
await fs.mkdir(OUT,{recursive:true});
await Promise.all(Array.from({length:CONCURRENCY},()=>worker()));
manifest.completed_at=new Date().toISOString();manifest.elapsed_ms=Date.now()-started;
await fs.writeFile(path.join(OUT,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({schema:manifest.schema,cell_count:manifest.cell_count,language_count:manifest.language_count,total_files:manifest.total_files,total_public_files:manifest.total_public_files,total_research_only_files:manifest.total_research_only_files,total_blocked_cells:manifest.total_blocked_cells,source_counts:manifest.source_counts,manifest:path.relative(ROOT,path.join(OUT,'manifest.json'))},null,2));
