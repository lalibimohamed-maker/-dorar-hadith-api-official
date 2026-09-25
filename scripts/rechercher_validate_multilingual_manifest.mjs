#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {assertTrustedSource,validateEvidenceRecord} from './rechercher_strict_evidence_pipeline.mjs';
const ROOT=process.cwd();
const manifestPath=process.argv[2]||path.join(ROOT,'artifacts/rechercher/multilingual-pdf-acquisition/manifest.json');
const registry=JSON.parse(await fs.readFile(path.join(ROOT,'config/rechercher/islamic-source-adapters-2026.json'),'utf8'));
const master=JSON.parse(await fs.readFile(path.join(ROOT,'books-batches/salaf-01-400h/master-global-source-registry-seed-2026-09.json'),'utf8'));
const worldwide=JSON.parse(await fs.readFile(path.join(ROOT,'research/evidence/global-multilingual/worldwide-source-link-registry-2026-09-24.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const adapters=new Map(registry.adapters.map(a=>[a.id,a])),
  sources=new Map([...((master.sources||[]).map(s=>[s.id,s])),...((worldwide.sources||[]).map(s=>[s.id,s]))]);
const known=new Set([...adapters.keys(),...sources.keys()]),allowedOrigins=new Set();
const add=v=>{try{const u=new URL(v);if(u.protocol==='https:')allowedOrigins.add(u.origin);}catch{}};
for(const a of adapters.values()){for(const o of a.origins||[])add(o);add(a.base_url);add(a.api_base_url);}
for(const s of sources.values())add(s.url);
const cells=manifest.cells||manifest.languages||{},errors=[],warnings=[],err=(code,detail)=>errors.push({code,detail});
for(const [key,entry] of Object.entries(cells)){
  if(!entry.language||!entry.domain)err('cell_identity_missing',key);
  for(const file of entry.files||[]){
    if(!file.url||!file.source){err('file_provenance_missing',{key,file});continue;}
    const deduplicated=file.deduplicated===true;
    if(deduplicated){
      if(!/^[a-f0-9]{64}$/.test(String(file.sha256||'')))err('sha256_invalid',{key,path:file.path||null});
      if(!Number.isInteger(file.bytes)||file.bytes<=0)err('size_invalid',{key,path:file.path||null});
      if(file.path!==undefined && !String(file.path).toLowerCase().endsWith('.pdf'))err('not_pdf_path',{key,path:file.path});
      const v=validateEvidenceRecord({sourceId:file.source,url:file.url,provenance:file.provenance||file.source+':'+file.url,rightsStatus:file.rights||entry.rights,role:'original',promoteToCorpus:false});
      if(!v.valid)err('evidence_invalid',{key,path:file.path||null,errors:v.errors});
      if(file.promoteToCorpus===true)err('corpus_promotion_forbidden',{key,path:file.path||null});
      continue;
    }
    if(!known.has(file.source))err('unknown_file_source',{key,source:file.source});
    else try{assertTrustedSource({url:file.url,allowedOrigins,sourceId:file.source});}catch{err('source_origin_not_allowlisted',{key,source:file.source,url:file.url});}
    if(!/^[a-f0-9]{64}$/.test(String(file.sha256||'')))err('sha256_invalid',{key,path:file.path});
    if(!Number.isInteger(file.bytes)||file.bytes<=0)err('size_invalid',{key,path:file.path});
    if(!String(file.path||'').toLowerCase().endsWith('.pdf'))err('not_pdf_path',{key,path:file.path});
    if(/\.pdf\.enc(?:$|\?)/i.test(String(file.path||'')))err('encrypted_pdf_forbidden',{key,path:file.path});
    const v=validateEvidenceRecord({sourceId:file.source,url:file.url,provenance:file.provenance||file.source+':'+file.url,rightsStatus:file.rights||entry.rights,role:'original',promoteToCorpus:false});
    if(!v.valid)err('evidence_invalid',{key,path:file.path,errors:v.errors});
    if(file.promoteToCorpus===true)err('corpus_promotion_forbidden',{key,path:file.path});
  }
}
if(Object.keys(cells).length!==3192)err('matrix_cell_count_mismatch',{expected:3192,observed:Object.keys(cells).length});
if(manifest.total_files!==undefined){const n=Object.values(cells).reduce((s,e)=>s+(e.files||[]).filter(f=>f.deduplicated!==true).length,0);if(n!==manifest.total_files)err('total_files_mismatch',{declared:manifest.total_files,observed:n});}
const result={schema:'rechercher/multilingual-manifest-validation/v3',cell_count:Object.keys(cells).length,total_files:Object.values(cells).reduce((s,e)=>s+(e.files||[]).filter(f=>f.deduplicated!==true).length,0),errors,warnings,valid:errors.length===0};
console.log(JSON.stringify(result,null,2));if(errors.length)process.exitCode=1;
