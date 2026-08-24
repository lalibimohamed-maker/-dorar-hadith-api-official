import fs from "node:fs";

const manifest="artifacts/source-refresh/manifest.json";
if(!fs.existsSync(manifest)){ console.log("No refresh manifest; nothing to analyze."); process.exit(0); }
const data=JSON.parse(fs.readFileSync(manifest,"utf8"));
const priorPath="config/source-refresh-baselines.json";
let prior={sources:{}};
if(fs.existsSync(priorPath)) prior=JSON.parse(fs.readFileSync(priorPath,"utf8"));

const alerts=[];
for(const s of data.sources||[]){
  const old=prior.sources?.[s.id];
  if(s.status!=="verified"){ alerts.push({id:s.id,type:"blocked-source",severity:"high"}); continue; }
  if(old){
    if(old.finalUrl && old.finalUrl!==s.finalUrl) alerts.push({id:s.id,type:"final-url-change",severity:"high",from:old.finalUrl,to:s.finalUrl});
    if(Number.isFinite(old.bytes) && old.bytes>0){
      const ratio=s.bytes/old.bytes;
      if(ratio>10 || ratio<0.1) alerts.push({id:s.id,type:"extreme-size-change",severity:"high",ratio});
    }
    if(old.sha256===s.sha256) alerts.push({id:s.id,type:"unchanged",severity:"info"});
    else alerts.push({id:s.id,type:"content-changed",severity:"info"});
  } else alerts.push({id:s.id,type:"new-baseline-required",severity:"medium"});
}

fs.mkdirSync("artifacts/source-refresh",{recursive:true});
fs.writeFileSync("artifacts/source-refresh/anomalies.json",JSON.stringify({
 schemaVersion:1,
 mode:"quarantine-on-anomaly",
 generatedAt:new Date().toISOString(),
 alertCount:alerts.length,
 alerts
},null,2)+"\n");

const high=alerts.filter(x=>x.severity==="high");
if(high.length){
 console.error("High-severity source anomalies detected. Candidate remains quarantined; authoritative Corpus is unchanged.");
 process.exit(2);
}
console.log("No high-severity source anomalies.");
