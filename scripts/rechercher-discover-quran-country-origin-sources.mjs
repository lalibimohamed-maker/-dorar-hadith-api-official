#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const CONFIG=path.join(ROOT,"config/quran-country-origin-source-registry-2026-09-22.json");
const OUT=path.join(ROOT,"artifacts/quran-country-origin-source-discovery");
const TIMEOUT_MS=20000;

const TRUSTED_DISCOVERY_URLS = Object.freeze({
  "bd-quran-gov-bd": ["https://quran.gov.bd/", "https://quran.gov.bd/home/ebook_download.html"],
  "tr-diyanet-kuran": ["https://kuran.diyanet.gov.tr/", "https://kuran.diyanet.gov.tr/Yayinlar", "https://dijital.diyanet.gov.tr/Kitaplik/kuran-kitapligi"],
  "id-kemenag-lajnah": ["https://pustakalajnah.kemenag.go.id/", "https://lajnah.kemenag.go.id/info-lpmq/unduhan/terjemah-al-quran.html"],
  "ma-ministry-habous-mohammedan-mushaf": ["https://habous.gov.ma/fr/component/content/article/6558-la-mise-en-ligne-de-al-moshaf-almohammadi.html"],
  "my-jakim-smart-quran": ["https://www.islam.gov.my/ms/quran-hadith/smart-quran"],
  "ir-moshaf-quran-publishing-center": ["https://moshaf.org/", "https://moshaf.org/fa/about/", "https://shop.moshaf.org/product/search/brand/168-quran-publishing-center-%D9%85%D8%B1%D9%83%D8%B2-%D8%B7%D8%A8%D8%B9-%D9%88-%D9%86%D8%B4%D8%B1-%D9%82%D8%B1%D8%A2%D9%86-%DA%A9%D8%B1%DB%8C%D9%85"],
  "sa-kfgqpc-country-origin": ["https://qurancomplex.gov.sa/en/kfgqpc/kfq-structure/"]
});

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
  const urls = TRUSTED_DISCOVERY_URLS[source.source_id] || [];
  for(const url of urls) probes.push(await probe(url));
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
