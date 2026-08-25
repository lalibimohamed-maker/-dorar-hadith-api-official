import fs from "node:fs";
import crypto from "node:crypto";
import { authorize, CAPABILITY } from "../src/security/security-shield.js";

const actor = process.env.SECURITY_ACTOR || "source-refresh";
const capabilities = String(process.env.SECURITY_CAPABILITIES || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const security = authorize({ capabilities, requested: CAPABILITY.SOURCE_REFRESH });
if (!security.allowed) {
  console.error(`Source refresh denied by Security Shield: ${security.reason}`);
  process.exit(2);
}

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
      results.push({id,url:s.url,status:"verified",finalUrl:u.toString(),bytes,sha256:hash.digest("hex"),checkedAt:new Date().toISOString(),actor});
      ok=true; break;
    }
    if(!ok) throw new Error("redirect limit exceeded");
  }catch(e){
    results.push({id,url:s.url,status:"blocked",error:e.message,checkedAt:new Date().toISOString(),actor});
  }
}
fs.mkdirSync("artifacts/source-refresh",{recursive:true});
fs.writeFileSync("artifacts/source-refresh/manifest.json",JSON.stringify({schemaVersion:1,mode:"verification-only",security:{actor,capabilities:[CAPABILITY.SOURCE_REFRESH]},sources:results},null,2)+"\n");
if(results.some(x=>x.status!=="verified")) process.exit(1);
