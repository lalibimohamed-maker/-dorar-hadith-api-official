import fs from "node:fs";
import path from "node:path";
const root=process.cwd(), dir=path.join(root,"config"), errors=[];
const required=["id","type","source_id","provenance","verification_state"];
const states=new Set(["pending","verified","rejected","needs_review"]);
function read(name){const p=path.join(dir,name);if(!fs.existsSync(p)){errors.push(`Missing required file: ${name}`);return null}try{return JSON.parse(fs.readFileSync(p,"utf8"))}catch(e){errors.push(`Invalid JSON: ${name}: ${e.message}`);return null}}
const gate=read("corpus-ingestion-gate-2026.json");
const files=fs.readdirSync(dir).filter(f=>/^corpus-ingestion-batch-\d+-\d{4}-\d{2}-\d{2}\.json$/.test(f));
if(!files.length) errors.push("No corpus ingestion batches found");
const ids=new Set();
for(const file of files){const batch=read(file);if(!batch||!Array.isArray(batch.records)){errors.push(`Batch has no records array: ${file}`);continue}for(const r of batch.records){for(const k of required)if(!(k in r))errors.push(`${file}: missing ${k}`);if(r.id&&ids.has(r.id))errors.push(`Duplicate record id: ${r.id}`);if(r.id)ids.add(r.id);if(r.verification_state&&!states.has(r.verification_state))errors.push(`${file}:${r.id}: invalid verification_state`);if(r.verification_state==="verified")errors.push(`${file}:${r.id}: seed records must not be pre-verified`);if(!r.provenance||typeof r.provenance!=="object")errors.push(`${file}:${r.id}: provenance must be an object`)}}
if(gate){for(const k of required)if(!gate.requiredFields?.includes(k))errors.push(`Gate missing required field: ${k}`);const rules=gate.canonicalRules||{};if(rules.quranArabicTextImmutable!==true)errors.push("Quran immutability rule missing");if(rules.translationIsMeaningNotOriginal!==true)errors.push("Translation/original separation missing");if(rules.tafsirSeparatedFromQuran!==true)errors.push("Tafsir/Quran separation missing");if(rules.fatwaAttributedToIssuer!==true)errors.push("Fatwa attribution missing");if(rules.scholarlyDisagreementPreserved!==true)errors.push("Disagreement preservation missing")}
if(errors.length){console.error(errors.join("\n"));process.exit(1)}
console.log(`Corpus ingestion validation passed: ${files.length} batch file(s), ${ids.size} unique seed record(s).`);