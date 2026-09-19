#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  JURISDICTIONS,
  RIGHTS_DECISIONS,
  buildSearchRecord,
  inspectSourceUrl,
  searchAuthorDeath
} from '../src/rechercher-rights-engine.js';

const INDEX = process.env.INDEX || 'data/corpus/waqfeya/century-15/index.jsonl';
const START = Math.max(0, Number(process.env.START || '0'));
const COUNT = Math.max(1, Number(process.env.COUNT || '100'));
const OUT = process.env.OUT || `data/corpus/rechercher/waqfeya-${START}-${COUNT}.jsonl`;
const JURISDICTION = JURISDICTIONS[process.env.JURISDICTION || 'DZ'] || JURISDICTIONS.DZ;

function clean(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim();
}
function field(text, label, nextLabels) {
  const stop = nextLabels.join('|');
  const re = new RegExp(`${label}\\s*([\\s\\S]*?)(?=${stop}|$)`, 'iu');
  return clean(text.match(re)?.[1]);
}
function yearFrom(value) {
  const western = String(value || '').match(/[12]\\d{3}/u)?.[0];
  if (western) return Number(western);
  const hijri = String(value || '').match(/(1[23]|14|15)\\d{2}/u)?.[0];
  if (hijri) return null;
  return null;
}

function parseWaqfeya(text, titleHint) {
  const labels = ['المؤلف', 'تفاصيل النسخة', 'تاريخ النشر', 'حجم الملف', 'أُضيف للمكتبة', 'عدد المجلدات', 'حالة الفهرسة', 'المشاهدات', 'الناشر', 'عدد الصفحات', 'نبذة عن الكتاب', 'روابط التحميل المباشرة', 'تصفح الكتاب', 'نص الكتاب'];
  const author = field(text, 'المؤلف', labels.slice(1));
  const publication = field(text, 'تاريخ النشر', labels.slice(2));
  const publisher = field(text, 'الناشر', labels.slice(9));
  const notes = field(text, 'نبذة عن الكتاب', labels.slice(11));
  return {
    title: titleHint || field(text, '#', labels),
    author,
    publisher,
    editionYear: yearFrom(publication),
    publicationRaw: publication,
    notes,
    rightsText: notes
  };
}

async function main() {
  const lines = (await readFile(INDEX, 'utf8')).trim().split(/\r?\n/).filter(Boolean);
  const slice = lines.slice(START, START + COUNT).map(JSON.parse);
  const output = [];
  for (const row of slice) {
    try {
      const inspected = await inspectSourceUrl(row.sourcePage);
      const meta = parseWaqfeya(inspected.metadata.text, row.titleHint);
      const death = meta.author ? await searchAuthorDeath(meta.author) : { found: false, reason: 'author-missing' };
      const evidence = [];
      if (/وقف لله|وقف لله تعالى/u.test(meta.notes || '')) evidence.push({ source: row.sourcePage, kind: 'waqf', text: meta.notes });
      if (/جميع الحقوق محفوظة|لا يسمح بإعادة|يمنع إعادة النشر/iu.test(meta.notes || '')) evidence.push({ source: row.sourcePage, kind: 'copyright-reservation', text: meta.notes });
      const record = buildSearchRecord({
        source: 'المكتبة الوقفية',
        sourceUrl: row.sourcePage,
        title: meta.title,
        author: meta.author,
        publisher: meta.publisher,
        editionYear: meta.editionYear,
        notes: meta.notes,
        evidence,
        jurisdiction: JURISDICTION
      }, { title: meta.title, author: meta.author, publisher: meta.publisher, rights: meta.rightsText, rightsSignals: [] });
      if (death.found) {
        record.authorDeathYear = death.deathYear;
        record.authorWikidata = { qid: death.qid, label: death.label, source: death.source };
        const reclassified = buildSearchRecord({ ...record, authorDeathYear: death.deathYear }, { rightsSignals: record.rightsEvidence });
        record.rightsDecision = reclassified.rightsDecision;
        record.workStatus = reclassified.workStatus;
        record.editionNeedsReview = reclassified.editionNeedsReview;
        record.classificationReason = reclassified.classificationReason;
      } else {
        record.authorDeathLookup = death;
        record.rightsDecision = RIGHTS_DECISIONS.UNCLEAR;
        record.editionNeedsReview = true;
      }
      output.push({ ...record, index: row.index, sourceIndex: row.sourceIndex, titleHint: row.titleHint, httpStatus: inspected.httpStatus, finalUrl: inspected.finalUrl, contentType: inspected.contentType });
    } catch (error) {
      output.push({ index: row.index, sourcePage: row.sourcePage, titleHint: row.titleHint, rightsDecision: 'unreachable', editionNeedsReview: true, error: String(error?.message || error) });
    }
  }
  output.sort((a, b) => a.index - b.index);
  await mkdir('data/corpus/rechercher', { recursive: true });
  const payload = output.map(x => JSON.stringify(x)).join('\n') + (output.length ? '\n' : '');
  await writeFile(OUT, payload, 'utf8');
  console.log(JSON.stringify({ output: OUT, start: START, count: output.length, sha256: createHash('sha256').update(payload).digest('hex') }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message || error); process.exitCode = 1; });
