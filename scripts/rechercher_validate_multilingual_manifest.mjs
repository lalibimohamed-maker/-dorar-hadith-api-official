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
const isDeduplicatedReference=file=>file?.deduplicated===true&&typeof file?.duplicate_of==='string'&&file.duplicate_of.length>0;
const isPdfPath=file=>String(file?.path||'').toLowerCase().endsWith('.pdf');
const isDocxPath=file=>String(file?.path||'').toLowerCase().endsWith('.docx');
const isPhysicalSourceFile=file=>isPdfPath(file)||isDocxPath(file);
for(const [key,entry] of Object.entries(cells)){
  if(!entry.language||!entry.domain)err('cell_identity_missing',key);
  for(const file of entry.files||[]){
    if(!file.url||!file.source){err('file_provenance_missing',{key,file});continue;}
    if(!known.has(file.source))err('unknown_file_source',{key,source:file.source});
    else try{assertTrustedSource({url:file.url,allowedOrigins,sourceId:file.source});}catch{err('source_origin_not_allowlisted',{key,source:file.source,url:file.url});}
    if(!/^[a-f0-9]{64}$/.test(String(file.sha256||'')))err('sha256_invalid',{key,path:file.path});
    if(!Number.isInteger(file.bytes)||file.bytes<=0)err('size_invalid',{key,path:file.path});
    const deduplicatedReference=isDeduplicatedReference(file);
    if(file?.deduplicated===true&&!deduplicatedReference)err('deduplication_reference_missing',{key,duplicate_of:file?.duplicate_of});
    if(!deduplicatedReference&&!isPhysicalSourceFile(file))err('unsupported_source_file_path',{key,path:file.path});
    if(/\.pdf\.enc$/i.test(String(file.path||'')))err('encrypted_pdf_forbidden',{key,path:file.path});
    if(!deduplicatedReference && isPhysicalSourceFile(file)){
      const expectedFormat=isDocxPath(file)?'docx':'pdf';
      if(file.format && String(file.format).toLowerCase()!==expectedFormat)err('format_extension_mismatch',{key,path:file.path,format:file.format,expected:expectedFormat});
      if(expectedFormat==='docx' && file.original!==true)err('docx_original_required',{key,path:file.path});
      if(expectedFormat==='pdf' && file.derived===true){
        if(!/^[a-f0-9]{64}$/i.test(String(file.derived_from_sha256||'')))err('derived_pdf_source_sha256_missing',{key,path:file.path});
        if(String(file.derived_from_format||'').toLowerCase()!=='docx')err('derived_pdf_source_format_invalid',{key,path:file.path,derived_from_format:file.derived_from_format});
      }
    }
    const v=validateEvidenceRecord({sourceId:file.source,url:file.url,provenance:file.provenance||file.source+':'+file.url,rightsStatus:file.rights||entry.rights,role:'original',promoteToCorpus:false});
    if(!v.valid)err('evidence_invalid',{key,path:file.path,errors:v.errors});
    if(file.promoteToCorpus===true)err('corpus_promotion_forbidden',{key,path:file.path});
  }
}
if(Object.keys(cells).length!==3192)err('matrix_cell_count_mismatch',{expected:3192,observed:Object.keys(cells).length});
const fileRecords=Object.values(cells).flatMap(e=>e.files||[]);
const physicalFiles=fileRecords.filter(file=>!isDeduplicatedReference(file)&&isPhysicalSourceFile(file));
if(manifest.total_files!==undefined){const n=physicalFiles.length;if(n!==manifest.total_files)err('total_files_mismatch',{declared:manifest.total_files,observed:n});}
const pdfFiles=physicalFiles.filter(isPdfPath),docxFiles=physicalFiles.filter(isDocxPath);
const derivedPdfFiles=pdfFiles.filter(file=>file.derived===true);
for(const file of derivedPdfFiles){
  const sameCell=fileRecords.find(x=>x!==file&&!isDeduplicatedReference(x)&&isDocxPath(x)&&x.sha256===file.derived_from_sha256);
  if(!sameCell) err('derived_pdf_source_missing',{sha256:file.derived_from_sha256,path:file.path});
}
for(const entry of Object.values(cells)){
  const docx=entry.files?.filter(x=>!isDeduplicatedReference(x)&&isDocxPath(x))||[];
  const derived=entry.files?.filter(x=>!isDeduplicatedReference(x)&&isPdfPath(x)&&x.derived===true)||[];
  if(derived.length>0 && docx.length===0) err('derived_pdf_without_docx',{key:entry.cell_id});
}
const result={schema:'rechercher/multilingual-manifest-validation/v4',cell_count:Object.keys(cells).length,total_files:physicalFiles.length,pdf_files:pdfFiles.length,docx_files:docxFiles.length,derived_pdf_files:derivedPdfFiles.length,file_records:fileRecords.length,errors,warnings,valid:errors.length===0};
console.log(JSON.stringify(result,null,2));if(errors.length)process.exitCode=1;
