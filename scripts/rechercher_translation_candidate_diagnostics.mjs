import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] || 'artifacts/rechercher/global-multilingual-research';
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.jsonl')).sort();
if (files.length !== 3) throw new Error(`Candidate diagnostics expected 3 shard JSONL files; found ${files.length}`);

const translationDomains = new Set(['quran', 'hadith', 'hadith_explanation', 'sunnah']);
const reasonFields = [
  ['publisher_or_translator', 'publisherOrTranslator'],
  ['source_id', 'sourceId'],
  ['source_version', 'sourceVersion'],
  ['rights_state', 'rightsState'],
  ['verification_state', 'verificationState'],
  ['canonical_text_relation', 'canonicalTextRelation'],
  ['last_checked_at', 'lastCheckedAt']
];

const rows = files.flatMap((file) => fs.readFileSync(path.join(dir, file), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse));
const diagnostics = {schema:'rechercher/translation-candidate-diagnostics/v1', generated_at:new Date().toISOString(), total_rows:rows.length, translation_domain_rows:0, candidates:0, candidate_reasons:{}, critical_integrity_alerts:0, critical_events:[]};

function recordFor(row) {
  const stage = row.stages?.find((s) => s.stage === 'translation_metadata');
  return row.translation_record || stage?.translation_record || null;
}

for (const row of rows) {
  if (row.machine_translation_used === true || row.canonical_arabic_overwrite === true) {
    diagnostics.critical_integrity_alerts += 1;
    diagnostics.critical_events.push({cell_id:row.cell_id, language_iso:row.language_iso, domain:row.domain, machine_translation_used:row.machine_translation_used === true, canonical_arabic_overwrite:row.canonical_arabic_overwrite === true});
  }
  if (!translationDomains.has(row.domain)) continue;
  diagnostics.translation_domain_rows += 1;
  if (row.translation_state !== 'candidate') continue;
  diagnostics.candidates += 1;
  const record = recordFor(row) || {};
  const reasons = [];
  for (const [reason, field] of reasonFields) {
    if (record[field] === undefined || record[field] === null || String(record[field]).trim() === '') reasons.push(reason);
  }
  if (!reasons.length) reasons.push('translation-record-complete-but-source-verification-incomplete');
  for (const reason of reasons) diagnostics.candidate_reasons[reason] = (diagnostics.candidate_reasons[reason] || 0) + 1;
}

fs.writeFileSync(path.join(dir, 'translation-candidate-diagnostics.json'), JSON.stringify(diagnostics, null, 2) + '\n');
if (diagnostics.critical_integrity_alerts > 0) {
  console.error(`::error title=CRITICAL translation integrity violation::${diagnostics.critical_integrity_alerts} row(s) attempted forbidden machine translation or canonical Arabic overwrite.`);
  console.error(JSON.stringify(diagnostics.critical_events));
  process.exitCode = 2;
} else {
  console.log(JSON.stringify(diagnostics));
}
