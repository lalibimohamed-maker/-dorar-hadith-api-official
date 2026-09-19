import fs from 'node:fs/promises';
import path from 'node:path';

const dir = process.argv[2] || 'artifacts/rechercher/global-multilingual-research';
const translationDomains = new Set(['quran', 'hadith', 'hadith_explanation', 'sunnah']);
const requiredRecordFields = ['translationId','language','publisherOrTranslator','sourceId','sourceVersion','rightsState','verificationState','canonicalTextRelation','lastCheckedAt'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cache = new Map();

async function inspect(url, languageIso) {
  if (cache.has(url)) return cache.get(url);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {redirect: 'follow', headers: {accept: 'application/json,text/html;q=0.9,*/*;q=0.1','user-agent': 'DinAllah-Rechercher-TranslationVerifier/2.0'}});
      const bytes = Buffer.from(await response.arrayBuffer());
      const text = bytes.toString('utf8').slice(0, 262144);
      let explicit = false; let method = 'none'; let matched = null;
      if (response.ok && response.headers.get('content-type')?.includes('json')) {
        try {
          const parsed = JSON.parse(text); const serialized = JSON.stringify(parsed);
          explicit = Array.isArray(parsed) ? parsed.length > 0 : Boolean(parsed?.translations?.length || parsed?.data?.length || parsed?.result?.length || serialized.includes(languageIso));
          method = explicit ? 'official_language_specific_api_returned_translation_records' : 'official_api_returned_no_translation_records';
          matched = explicit ? languageIso : null;
        } catch {}
      } else if (response.ok && text.length > 1000) {
        const isoNeedle = languageIso ? languageIso.toLowerCase() : ''; const lower = text.toLowerCase();
        explicit = Boolean(isoNeedle && (lower.includes(`/${isoNeedle}/`) || lower.includes(`lang="${isoNeedle}"`) || lower.includes(`lang='${isoNeedle}'`)));
        method = explicit ? 'official_language_specific_page_with_language_marker_and_content' : 'official_page_without_explicit_translation_marker';
        matched = explicit ? languageIso : null;
      }
      const result = {url,http_status:response.status,explicit_translation_evidence:explicit,evidence_method:method,matched_language_iso:matched,checked_at:new Date().toISOString()};
      cache.set(url,result); if (response.status === 429 || response.status >= 500) await sleep(1000 * (attempt + 1)); return result;
    } catch (error) {
      if (attempt === 3) { const result = {url,http_status:null,explicit_translation_evidence:false,evidence_method:'request-error',error:String(error?.message || error),checked_at:new Date().toISOString()}; cache.set(url,result); return result; }
      await sleep(800 * (attempt + 1));
    }
  }
}

function completeTranslationRecord(record) {
  return Boolean(record && requiredRecordFields.every((field) => record[field] !== undefined && record[field] !== null && String(record[field]).trim() !== ''));
}

const files = (await fs.readdir(dir)).filter((name) => name.endsWith('.jsonl')).sort();
if (files.length !== 3) throw new Error(`Translation gate expected 3 shard JSONL files; found ${files.length}`);
const summary = {schema:'rechercher/islamic-translation-verification-gate/v2',policy:'published-source-translations-only',machine_translation_allowed:false,canonical_arabic_overwrite_allowed:false,required_translation_record_fields:requiredRecordFields,files:files.length,total_rows:0,translation_domain_rows:0,source_verified_rows:0,explicit_source_evidence_rows:0,complete_translation_record_rows:0,translation_needed_rows:0,candidate_rows:0,invalid_claim_rows:0};

for (const file of files) {
  const filePath = path.join(dir,file); const rows = (await fs.readFile(filePath,'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse); const updated=[];
  for (const row of rows) {
    summary.total_rows += 1;
    if (row.machine_translation_used === true) throw new Error(`Machine translation is forbidden: ${row.cell_id}`);
    if (row.canonical_arabic_overwrite === true) throw new Error(`Canonical Arabic overwrite is forbidden: ${row.cell_id}`);
    if (!translationDomains.has(row.domain)) { updated.push(row); continue; }
    summary.translation_domain_rows += 1;
    const apiStage = row.stages.find((stage) => stage.stage === 'official_api'); const target = apiStage?.evidence?.url || null;
    const evidence = target ? await inspect(target,row.language_iso) : null; const translationStage = row.stages.find((stage) => stage.stage === 'translation_metadata');
    translationStage.translation_evidence = evidence;
    const existing = row.translation_record || translationStage.translation_record || null; const recordComplete = completeTranslationRecord(existing);
    if (recordComplete) summary.complete_translation_record_rows += 1;
    if (evidence?.explicit_translation_evidence === true) summary.explicit_source_evidence_rows += 1;
    if (evidence?.explicit_translation_evidence === true && recordComplete) { row.translation_state='source-verified'; translationStage.translation_record=existing; summary.source_verified_rows += 1; }
    else if (evidence?.explicit_translation_evidence === true) { row.translation_state='candidate'; translationStage.translation_record=existing || null; summary.candidate_rows += 1; }
    else { row.translation_state='translation-needed'; summary.translation_needed_rows += 1; }
    if (row.translation_state === 'source-verified' && !recordComplete) { summary.invalid_claim_rows += 1; throw new Error(`source-verified translation lacks complete publisher/version/rights record: ${row.cell_id}`); }
    if (row.final_verification === 'verified-evidence-chain' && row.translation_state !== 'source-verified') row.final_verification='partially-verified';
    updated.push(row);
  }
  await fs.writeFile(filePath,updated.map((row)=>JSON.stringify(row)).join('\n')+'\n','utf8');
}
await fs.writeFile(path.join(dir,'translation-verification-summary.json'),JSON.stringify(summary,null,2)+'\n','utf8');
console.log(JSON.stringify(summary));
