import fs from "node:fs";
import crypto from "node:crypto";

const manifest="artifacts/source-refresh/manifest.json";
if(!fs.existsSync(manifest)) process.exit(0);
const data=JSON.parse(fs.readFileSync(manifest,"utf8"));
if(!Array.isArray(data.sources)) throw new Error("invalid refresh manifest");
for(const s of data.sources){
  if(s.status!=="verified") throw new Error("blocked source present: "+s.id);
  if(!/^[a-f0-9]{64}$/.test(s.sha256)) throw new Error("invalid sha256 for "+s.id);
  if(s.bytes<0 || s.bytes>2*1024*1024) throw new Error("invalid size for "+s.id);
  if(!/^https:\/\//.test(s.finalUrl||"")) throw new Error("non-HTTPS final URL for "+s.id);
}
const digest=crypto.createHash("sha256").update(fs.readFileSync(manifest)).digest("hex");
fs.mkdirSync("artifacts/source-refresh",{recursive:true});
fs.writeFileSync("artifacts/source-refresh/manifest.sha256",digest+"  manifest.json\n");
console.log("Source refresh manifest integrity: OK");
