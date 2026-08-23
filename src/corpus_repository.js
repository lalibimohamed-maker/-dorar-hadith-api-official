import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const CONTENT_FILE=path.join(ROOT,'config','corpus-seed-content-batch-05-2026-08-22.json');
const ROUTING_FILE=path.join(ROOT,'config','corpus-source-routing-2026.json');
const CONCEPT_INDEX_FILE=path.join(ROOT,'data','concept-index-seed-2026.json');
const GHAIB_EVIDENCE_FILE=path.join(ROOT,'config','ghaib-evidence-catalog-2026.json');
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
export function loadCorpus(){
  const content=readJson(CONTENT_FILE);
  const defaultVerificationState=content.status || 'pending_verification';
  return Array.isArray(content.records)
    ? content.records.map(record => ({
        ...record,
        verification_state: record.verification_state || defaultVerificationState
      }))
    : [];
}
export function loadRouting(){return readJson(ROUTING_FILE);}
export function loadConceptIndex(){return readJson(CONCEPT_INDEX_FILE);}
export function loadGhaybEvidence(){return readJson(GHAIB_EVIDENCE_FILE);}
export function findGhaybEvidence(conceptId){
  const catalog=loadGhaybEvidence();
  return (catalog.records||[]).filter(record=>record.concept===conceptId);
}
