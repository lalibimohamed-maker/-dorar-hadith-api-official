import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AQEEDAH_FILE = path.join(ROOT, 'config', 'aqeedah-source-routing-2026.json');
const MANHAJ_FILE = path.join(ROOT, 'config', 'manhaj-aqidah-2026.json');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

export function loadMethodologyPolicy() {
  return { aqeedah: readJson(AQEEDAH_FILE), manhaj: readJson(MANHAJ_FILE) };
}

export function routeConcept(record, { comparative = false } = {}) {
  const domain = record?.domain || 'general';
  const policy = loadMethodologyPolicy();
  if (domain !== 'aqidah') {
    return {
      domain,
      mode: 'domain_sources',
      comparative: false,
      sourcePolicy: 'domain-specific',
      primaryBasis: ['Quran', 'authentic Sunnah'],
      note: 'يُطبق توجيه المصادر الخاص بالمجال مع حفظ نسبة الأقوال والخلاف.'
    };
  }

  return {
    domain,
    mode: comparative ? 'sunni_primary_plus_comparative' : 'sunni_primary',
    comparative,
    identity: policy.manhaj.methodologicalFramework.identity,
    primaryBasis: policy.manhaj.methodologicalFramework.primaryFoundations,
    sourcePriority: policy.aqeedah.sourceHierarchy,
    scholarRules: {
      workLevelVerification: true,
      fiqhOrUsulDoesNotImplyCreedEndorsement: true,
      comparativeTheologySeparateLayer: true,
      comparativeSourcesHiddenFromPrimaryByDefault: !comparative
    },
    display: {
      primaryLabel: 'العقيدة وفق طبقة المصادر الأساسية',
      comparativeLabel: 'دراسة مقارنة — منسوبة لصاحبها ولا تمثل طبقة العقيدة الأساسية',
      sourceOnDemand: true
    }
  };
}

export function filterConceptKnowledge(knowledge = {}, domain = 'general', comparative = false) {
  const out = { ...knowledge };
  if (domain !== 'aqidah') return out;

  const sources = Array.isArray(out.sources) ? out.sources : [];
  const primary = [];
  const comparison = [];
  for (const source of sources) {
    const role = source?.creedRole || source?.methodologyRole || 'primary_sunni';
    if (role === 'comparative' || role === 'non_sunni') comparison.push(source);
    else primary.push(source);
  }
  out.sources = primary;
  if (comparative && comparison.length) out.comparative_sources = comparison;
  return out;
}
