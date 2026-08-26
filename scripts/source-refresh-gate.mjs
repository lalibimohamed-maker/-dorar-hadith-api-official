import fs from "node:fs";
import crypto from "node:crypto";

const files=["config/source-registry.json","config/official-islamic-sources-2026.json"];
const sources=new Map();

for(const file of files){
  const data=JSON.parse(fs.readFileSync(file,"utf8"));
  for(const s of [...(data.sources||[]),...(data.officialSources||[])]){
    if(!s.url || !/^https:\/\//i.test(s.url)) continue;
    const u=new URL(s.url);
    if(u.username || u.password || u.port) continue;
    sources.set(s.id || s.nameAr || s.url,{...s,url:u.toString()});
  }
}

function classifyError(error){
  if(/^HTTP 4\d\d$/.test(error)) return "access-restricted";
  if(/^HTTP 5\d\d$/.test(error)) return "remote-server-error";
  if(/timed out|timeout|aborted/i.test(error)) return "timeout";
  if(/fetch failed|network|socket|dns|econn|enotfound/i.test(error)) return "network-error";
  if(/redirect/i.test(error)) return "redirect-policy-error";
  if(/response too large/i.test(error)) return "response-policy-error";
  if(/empty response body/i.test(error)) return "empty-response";
  return "verification-error";
}

const results=[];
for(const [id,s] of sources){
  let u=new URL(s.url);
  const originHost=u.hostname.toLowerCase();
  let ok=false;
  let error="";
  try{
    for(let n=0;n<4;n++){
      const r=await fetch(u,{redirect:"manual",signal:AbortSignal.timeout(15000),headers:{"user-agent":"DinAllah-source-refresh-gate/1.0"}});
      if(r.status>=300 && r.status<400){
        const location=r.headers.get("location");
        if(!location) throw new Error("redirect without destination");
        const next=new URL(location,u);
        if(next.protocol!=="https:" || next.hostname.toLowerCase()!==originHost || next.username || next.password || next.port) throw new Error("redirect rejected");
        u=next; continue;
      }
      if(!r.ok) throw new Error("HTTP "+r.status);
      const reader=r.body?.getReader();
      if(!reader) throw new Error("empty response body");
      const hash=crypto.createHash("sha256"); let bytes=0;
      while(true){
        const part=await reader.read(); if(part.done) break;
        bytes+=part.value.byteLength;
        if(bytes>2*1024*1024){await reader.cancel(); throw new Error("response too large");}
        hash.update(part.value);
      }
      results.push({id,url:s.url,status:"verified",finalUrl:u.toString(),bytes,sha256:hash.digest("hex"),checkedAt:new Date().toISOString()});
      ok=true; break;
    }
    if(!ok) throw new Error("redirect limit exceeded");
  }catch(e){
    error=e instanceof Error ? e.message : "unknown error";
    const category=classifyError(error);
    results.push({id,url:s.url,status:"blocked",category,error,checkedAt:new Date().toISOString()});
    console.error(`[source-refresh-gate] blocked source: ${String(id)} — ${category} — ${error}`);
  }
}
fs.mkdirSync("artifacts/source-refresh",{recursive:true});
const blocked=results.filter(x=>x.status!=="verified");
const categories=Object.fromEntries([...new Set(blocked.map(x=>x.category))].map(category=>[category,blocked.filter(x=>x.category===category).length]));
fs.writeFileSync("artifacts/source-refresh/manifest.json",JSON.stringify({schemaVersion:2,mode:"verification-only",summary:{total:results.length,verified:results.length-blocked.length,blocked:blocked.length,categories},sources:results},null,2)+"\n");
if(blocked.length){
  console.error(`[source-refresh-gate] verification failed: ${blocked.length} source(s) blocked`);
  for(const [category,count] of Object.entries(categories)) console.error(`[source-refresh-gate] ${category}: ${count}`);
  process.exit(1);
}
