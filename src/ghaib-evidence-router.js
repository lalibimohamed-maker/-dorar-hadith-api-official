import fs from 'node:fs';
import { getHadithEvidenceRegistry, searchHadithEvidence, canPresentAsVerifiedEvidence } from './hadith-evidence-registry.js';

const FRAMEWORK_PATH = 'config/ghaib-source-framework-2026.json';
const EVIDENCE_PATH = 'data/ghaib/evidence-seed-2026.json';

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

const framework = readJson(FRAMEWORK_PATH);
const evidence = readJson(EVIDENCE_PATH);
const hadithRegistry = getHadithEvidenceRegistry();

const ALIASES = {
  'المهدي المنتظر': 'eschatology', 'المهدي': 'eschatology',
  'ذو القرنين': 'prophetic_stories', 'الخضر': 'prophetic_stories', 'السامري': 'prophetic_stories',
  'الذي انسَلَخ من آيات الله': 'quran_tafsir', 'فانسلخ منها': 'quran_tafsir',
  'الروح': 'ruh', 'روح الله': 'creation', 'عيسى': 'creation', 'آدم': 'creation',
  'رجم الشياطين': 'shaytan', 'إبليس': 'shaytan', 'الشيطان': 'shaytan', 'الجن': 'jinn',
  'العرش': 'allah', 'الاستواء': 'istawa', 'الجبال': 'cosmology', 'السماوات': 'cosmology',
  'السماء': 'cosmology', 'القمر': 'cosmology', 'النجوم': 'cosmology',
  'كل في فلك يسبحون': 'cosmology', 'مفاتيح الغيب': 'unseen_keys',
  'الجنة': 'paradise', 'درجات الجنة': 'paradise', 'أبواب الجنة': 'paradise', 'أنهار الجنة': 'paradise',
  'القبر': 'barzakh', 'نعيم القبر': 'barzakh', 'عذاب القبر': 'barzakh', 'البرزخ': 'barzakh',
  'النار': 'hellfire', 'أبواب النار': 'hellfire', 'دركات النار': 'hellfire'
};

function normalize(text) {
  return String(text || '').trim().toLocaleLowerCase('ar')
    .replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');
}

function findDomain(query) {
  const q = normalize(query);
  for (const [alias, domain] of Object.entries(ALIASES)) {
    if (q === normalize(alias) || q.includes(normalize(alias)) || normalize(alias).includes(q)) return domain;
  }
  return null;
}

function hadithEvidenceForDomain(domain) {
  return hadithRegistry.records.filter(item => item.domain === domain);
}

export function routeGhaibQuestion(query, language = 'ar') {
  const domain = findDomain(query);
  const records = evidence.records.filter(item => !domain || item.domain === domain || item.subtopic === domain);
  const hadithEvidence = hadithEvidenceForDomain(domain);
  const requiresHadithCheck = ['مهدي', 'المهدي'].some(x => normalize(query).includes(normalize(x)));
  const verifiedHadith = hadithEvidence.filter(canPresentAsVerifiedEvidence);
  return {
    query, language, domain, matched: Boolean(domain), evidence: records,
    hadithEvidence,
    verifiedHadithEvidence: verifiedHadith,
    evidenceOrder: framework.evidenceOrder,
    requiresAqidahReview: framework.domains.find(d => d.id === domain)?.requires_aqidah_review === true,
    requiresHadithVerification: requiresHadithCheck || ['grave','barzakh','paradise','hellfire','intercession','hawd','eschatology'].includes(domain),
    safeguards: framework.displayRules,
    responsePlan: [
      'identify_concept', 'retrieve_primary_texts', 'verify_hadith_and_reports',
      'retrieve_cited_scholar_works', 'preserve_disagreement',
      'compose_in_requested_language', 'retain_original_arabic_and_source'
    ]
  };
}

export function getEvidenceForDomain(domain) { return evidence.records.filter(item => item.domain === domain); }
export function getHadithEvidenceForDomain(domain) { return searchHadithEvidence(domain); }
export function getHadithRegistry() { return hadithRegistry; }
