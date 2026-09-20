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
const errors=[];
const warnings=[];
const cells=new Map();

function error(code,detail){errors.push({code,detail});}
function warning(code,detail){warnings.push({code,detail});}
function addCell(id,entry){
  if(!id) return;
  const current=cells.get(id) || {id,entries:0,files:0};
  current.entries+=1;
  current.files+=(entry.files||[]).length;
  cells.set(id,current);
}

for(const [key,entry] of Object.entries(manifest.languages || {})){
  const records=entry.records || [];
  const cellId=entry.cell_id || entry.cellId || entry.matrix_cell_id || records[0]?.cell_id || records[0]?.cellId;
  addCell(cellId,entry);
  if(!cellId) warning('cell_id_missing',key);

  for(const file of entry.files || []){
    if(!file.url || !file.source) { error('file_provenance_missing',{key,file}); continue; }
    const adapter=adapters.get(file.source);
    if(!adapter) { error('unknown_source_adapter',{key,source:file.source}); continue; }
    try { assertTrustedSource({url:file.url,allowedOrigins,sourceId:file.source}); }
    catch(e){ error(e.message,{key,source:file.source,url:file.url}); }
    if(!/^[a-f0-9]{64}$/.test(String(file.sha256||''))) error('sha256_missing_or_invalid',{key,path:file.path});
    if(!Number.isInteger(file.bytes) || file.bytes<=0) error('file_size_missing_or_invalid',{key,path:file.path});
    if(!String(file.path||'').toLowerCase().endsWith('.pdf')) error('primary_file_must_be_pdf',{key,path:file.path});
    if(/\.pdf\.enc(?:$|\?)/i.test(String(file.path||''))) error('encrypted_primary_forbidden',{key,path:file.path});

    const role=file.role || (entry.acquisition==='research-only'?'original':'original');
    const validation=validateEvidenceRecord({
      sourceId:file.source,
      url:file.url,
      provenance:file.provenance || `${file.source}:${file.url}`,
      rightsStatus:file.rights || entry.rights,
      role,
      promoteToCorpus:file.promoteToCorpus===true
    });
    if(!validation.valid) error('evidence_record_invalid',{key,path:file.path,errors:validation.errors});
  }
}

if(manifest.cell_count !== undefined && manifest.cell_count !== cells.size){
  error('cell_count_mismatch',{declared:manifest.cell_count,observed:cells.size});
}
if(manifest.cell_count === undefined) warning('cell_count_not_declared','Manifest must declare cell_count when matrix records are available.');
if(manifest.language_count !== undefined && manifest.language_count !== Object.keys(manifest.languages||{}).length){
  error('language_count_mismatch',{declared:manifest.language_count,observed:Object.keys(manifest.languages||{}).length});
}

const result={schema:'rechercher/multilingual-manifest-validation/v1',manifest:manifestPath,language_count:Object.keys(manifest.languages||{}).length,cell_count:cells.size,errors,warnings,valid:errors.length===0};
console.log(JSON.stringify(result,null,2));
if(errors.length) process.exitCode=1;
