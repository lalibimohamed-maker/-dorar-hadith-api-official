#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const CONFIG=path.join(ROOT,"config/quran-country-origin-source-registry-2026-09-22.json");
const OUT=path.join(ROOT,"artifacts/quran-country-origin-source-discovery");
const TIMEOUT_MS=20000;

async function probe(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const r=await fetch(url,{redirect:"follow",signal:controller.signal,headers:{accept:"text/html,application/xhtml+xml,*/*"}});
    return {url,final_url:r.url,http_status:r.status,ok:r.ok,content_type:r.headers.get("content-type")||"",reachable:r.ok};
  }catch(error){
    return {url,reachable:false,error:String(error?.message||error)};
  }finally{clearTimeout(timer);}
}

const config=JSON.parse(await fs.readFile(CONFIG,"utf8"));
await fs.rm(OUT,{recursive:true,force:true});
await fs.mkdir(OUT,{recursive:true});
const sources=[];
for(const source of config.sources){
  const probes=[];
  for(const url of source.discovery_urls) probes.push(await probe(url));
  sources.push({...source,probes});
}
const manifest={
  schema_version:"2026-09-22",
  purpose:"Country-of-origin source discovery evidence only; no acquisition and no Corpus write.",
  corpus_write:false,
  ai_generated_translation:false,
  canonical_arabic_separate:true,
  source_count:sources.length,
  reachable_source_count:sources.filter(s=>s.probes.some(p=>p.reachable)).length,
  sources
};
await fs.writeFile(path.join(OUT,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
console.log(JSON.stringify({
  source_count:manifest.source_count,
  reachable_source_count:manifest.reachable_source_count,
  countries:[...new Set(sources.map(s=>s.country))]
},null,2));
