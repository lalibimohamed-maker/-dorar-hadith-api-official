import fs from "node:fs";
import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";

const files=["config/source-registry.json","config/official-islamic-sources-2026.json"];
const sources=new Map();
const MAX_RESPONSE_BYTES=2*1024*1024;
const REQUEST_TIMEOUT_MS=15000;
const MAX_REDIRECTS=3;

function isPrivateOrReservedAddress(address){
  if(net.isIPv4(address)){
    const [a,b,c,d]=address.split(".").map(Number);
    return a===10 ||
      a===127 ||
      (a===169 && b===254) ||
      (a===172 && b>=16 && b<=31) ||
      (a===192 && b===168) ||
      a===0 ||
      a>=224;
  }
  if(net.isIPv6(address)){
    const normalized=address.toLowerCase();
    return normalized==="::1" ||
      normalized==="::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:");
  }
  return true;
}

async function assertPublicSourceHost(url){
  const host=url.hostname.toLowerCase();
  if(!host || url.username || url.password || url.port) throw new Error("unsafe source URL");
  if(net.isIP(host)) {
    if(isPrivateOrReservedAddress(host)) throw new Error("private or reserved source address rejected");
    return;
  }
  const addresses=await dns.lookup(host,{all:true,verbatim:true});
  if(!addresses.length || addresses.some(({address})=>isPrivateOrReservedAddress(address))) {
    throw new Error("private or reserved DNS destination rejected");
  }
}

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
    for(let n=0;n<=MAX_REDIRECTS;n++){
      await assertPublicSourceHost(u);
      // codeql[js/file-access-to-http] Registry URLs are committed System-layer source metadata and are validated to HTTPS/public DNS destinations before this verification-only request.
      const r=await fetch(u,{redirect:"manual",signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS),headers:{"user-agent":"DinAllah-source-refresh-gate/1.0"}});
      if(r.status>=300 && r.status<400){
        const location=r.headers.get("location");
        if(!location) throw new Error("redirect without destination");
        const next=new URL(location,u);
        if(next.protocol!=="https:" || next.hostname.toLowerCase()!==originHost || next.username || next.password || next.port) throw new Error("redirect rejected");
        await assertPublicSourceHost(next);
        u=next; continue;
      }
      if(!r.ok) throw new Error("HTTP "+r.status);
      const reader=r.body?.getReader();
      if(!reader) throw new Error("empty response body");
      const hash=crypto.createHash("sha256"); let bytes=0;
      while(true){
        const part=await reader.read(); if(part.done) break;
        bytes+=part.value.byteLength;
        if(bytes>MAX_RESPONSE_BYTES){await reader.cancel(); throw new Error("response too large");}
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
  console.warn(`[source-refresh-gate] ${blocked.length} source(s) blocked; recorded in artifacts/source-refresh/manifest.json and retained for retry.`);
  for(const [category,count] of Object.entries(categories)) console.warn(`[source-refresh-gate] ${category}: ${count}`);
  console.warn("[source-refresh-gate] Source reachability is advisory; blocked sources do not fail the content pipeline.");
}
