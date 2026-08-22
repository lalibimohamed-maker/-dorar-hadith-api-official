import fs from "node:fs";
import path from "node:path";
const root=process.cwd(), dir=path.join(root,"config"), errors=[];
const required=["id","type","source_id","provenance","verification_state"];
const states=new Set(["pending","verified","rejected","needs_review"]);
function read(name){const p=path.join(dir,name);if(!fs.existsSync(p)){errors.push(`Missing required file: ${name}`);return null}try{return JSON.parse(fs.readFileSync(p,"utf8"))}catch(e){errors.push(`Invalid JSON: ${name}: ${e.message}`);return null}}
const gate=read("corpus-ingestion-gate-2026.json");
const canonicalBatch="corpus-ingestion-batch-04-2026-08-22.json";
const batch=read(canonicalBatch);
if(!batch||!Array.isArray(batch.records)) errors.push(`${canonicalBatch}: records array is required for canonical seed batches`);
const ids=new Set();
for(const r of batch?.records||[]){for(const k of required)if(!(k in r))errors.push(`${canonicalBatch}: missing ${k} on ${r.id||"unknown"}`);if(r.id&&ids.has(r.id))errors.push(`Duplicate record id: ${r.id}`);if(r.id)ids.add(r.id);if(r.verification_state&&!states.has(r.verification_state))errors.push(`${r.id}: invalid verification_state`);if(r.verification_state==="verified")errors.push(`${r.id}: seed records must not be pre-verified`);if(!r.provenance||typeof r.provenance!=="object")errors.push(`${r.id}: provenance must be an object`)}
if(gate){for(const k of required)if(!gate.requiredFields?.includes(k))errors.push(`Gate missing required field: ${k}`);const rules=gate.canonicalRules||{};for(const [k,msg] of Object.entries({quranArabicTextImmutable:"Quran immutability rule missing",translationIsMeaningNotOriginal:"Translation/original separation missing",tafsirSeparatedFromQuran:"Tafsir/Quran separation missing",fatwaAttributedToIssuer:"Fatwa attribution missing",scholarlyDisagreementPreserved:"Disagreement preservation missing"}))if(rules[k]!==true)errors.push(msg)}
if(errors.length){console.error(errors.join("\n"));process.exit(1)}
console.log(`Corpus ingestion validation passed: ${ids.size} canonical seed record(s). Historical batches remain source-linked metadata and are not reinterpreted as canonical records.`);