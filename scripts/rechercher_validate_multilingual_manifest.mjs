#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {assertTrustedSource, validateEvidenceRecord} from './rechercher_strict_evidence_pipeline.mjs';

const ROOT=process.cwd();
const manifestPath=process.argv[2] || path.join(ROOT,'artifacts/rechercher/multilingual-pdf-acquisition/manifest.json');
const registryPath=path.join(ROOT,'config/rechercher/islamic-source-adapters-2026.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const registry=JSON.parse(await fs.readFile(registryPath,'utf8'));
const adapters=new Map(registry.adapters.map(a=>[a.id,a]));
const allowedOrigins=new Set(registry.adapters.flatMap(a=>a.origins));
const EXPECTED_MATRIX_CELL_COUNT=3192;
const errors=[];const warnings=[];
const cells=manifest.cells || manifest.languages || {};
function error(code,detail){errors.push({code,detail})}
for(const [key,entry] of Object.entries(cells)){
  const cellId=entry.cell_id || key;
  if(!cellId)error('cell_id_missing',key);
  if(!entry.language || !entry.domain)error('cell_identity_missing',{key,language:entry.language,domain:entry.domain});
  if(!entry.provider)error('cell_provider_missing',key);
  else if(!adapters.has(entry.provider))error('unknown_source_adapter',{key,source:entry.provider});
  for(const file of entry.files||[]){
    if(!file.url||!file.source){error('file_provenance_missing',{key,file});continue}
    const adapter=adapters.get(file.source);
    if(!adapter){error('unknown_file_source_adapter',{key,source:file.source});continue}
    try{assertTrustedSource({url:file.url,allowedOrigins,sourceId:file.source})}catch(e){error(e.message,{key,source:file.source,url:file.url})}
    if(!/^[a-f0-9]{64}$/.test(String(file.sha256||'')))error('sha256_missing_or_invalid',{key,path:file.path});
    if(!Number.isInteger(file.bytes)||file.bytes<=0)error('file_size_missing_or_invalid',{key,path:file.path});
    if(!String(file.path||'').toLowerCase().endsWith('.pdf'))error('primary_file_must_be_pdf',{key,path:file.path});
    if(/\.pdf\.enc(?:$|\?)/i.test(String(file.path||'')))error('encrypted_primary_forbidden',{key,path:file.path});
    const validation=validateEvidenceRecord({
      sourceId:file.source,url:file.url,provenance:file.provenance||`${file.source}:${file.url}`,
      rightsStatus:file.rights||entry.rights,role:'original',promoteToCorpus:file.promoteToCorpus===true
    });
    if(!validation.valid)error('evidence_record_invalid',{key,path:file.path,errors:validation.errors});
  }
}
if(manifest.cell_count===undefined)error('cell_count_not_declared','Manifest must declare cell_count=3192.');
if(manifest.cell_count!==undefined&&manifest.cell_count!==Object.keys(cells).length)error('cell_count_mismatch',{declared:manifest.cell_count,observed:Object.keys(cells).length});
if(Object.keys(cells).length!==EXPECTED_MATRIX_CELL_COUNT)error('matrix_cell_count_mismatch',{expected:EXPECTED_MATRIX_CELL_COUNT,observed:Object.keys(cells).length});
if(Number.isInteger(manifest.total_files)){
  const observed=Object.values(cells).reduce((n,e)=>n+(e.files||[]).length,0);
  if(observed!==manifest.total_files)error('total_files_mismatch',{declared:manifest.total_files,observed});
}
const result={schema:'rechercher/multilingual-manifest-validation/v2',manifest:manifestPath,language_count:manifest.language_count??null,cell_count:Object.keys(cells).length,total_files:Object.values(cells).reduce((n,e)=>n+(e.files||[]).length,0),errors,warnings,valid:errors.length===0};
console.log(JSON.stringify(result,null,2));
if(errors.length)process.exitCode=1;
