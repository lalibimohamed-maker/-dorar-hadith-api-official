import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const ingestion=JSON.parse(fs.readFileSync(path.join(root,"config/rijal-corpus-ingestion.json"),"utf8"));
const access=JSON.parse(fs.readFileSync(path.join(root,"config/rijal-book-access.json"),"utf8"));
const ids=new Set(access.books.map(b=>b.id)); const errors=[];
for(const id of [...ingestion.initialBatch.map(x=>x.sourceId),...ingestion.expansionOrder]) if(!ids.has(id)) errors.push(`Missing book-access record: ${id}`);
if(ingestion.recordOutput.defaultVerificationState!=="unverified") errors.push("Default verification must remain unverified");
if(!ingestion.policy.extractOnlyFromRegisteredEdition) errors.push("Extraction must be restricted to registered editions");
if(!ingestion.policy.preserveOriginalAttribution||!ingestion.policy.preserveTextLocator||!ingestion.policy.preserveReaderLink) errors.push("Provenance policy is incomplete");
if(ingestion.policy.autoVerify!==false) errors.push("Automatic verification must remain disabled");
if(errors.length){console.error(errors.join("\n"));process.exit(1)}
console.log(`Rijal corpus configuration valid: ${ingestion.initialBatch.length} initial + ${ingestion.expansionOrder.length} expansion sources.`);
