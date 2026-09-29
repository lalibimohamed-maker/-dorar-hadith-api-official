import fs from "node:fs";
const x=JSON.parse(fs.readFileSync("config/rechercher-omega-engine-storage-bridge-2026.json","utf8"));
if(x.storageRepository!=="lalibimohamed-maker/rechercher-omega-engine-storage"||!x.releaseAssetOnly) throw new Error("invalid Omega storage bridge");
console.log("PASS: Omega private engine storage bridge");
