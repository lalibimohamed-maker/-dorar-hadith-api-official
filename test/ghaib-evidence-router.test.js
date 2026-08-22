import { routeGhaibQuestion, getEvidenceForDomain } from '../src/ghaib-evidence-router.js';

const cases = [
  ['المهدي المنتظر', 'eschatology'],
  ['قصة ذي القرنين', 'prophetic_stories'],
  ['الخضر', 'prophetic_stories'],
  ['السامري', 'prophetic_stories'],
  ['فانسلخ منها فأتبعه الشيطان', 'quran_tafsir'],
  ['رجم الشياطين', 'shaytan'],
  ['إبليس', 'shaytan'],
  ['روح الله عيسى', 'creation'],
  ['كل في فلك يسبحون', 'cosmology'],
  ['مفاتيح الغيب', 'unseen_keys']
];

for (const [query, domain] of cases) {
  const result = routeGhaibQuestion(query, 'ar');
  if (result.domain !== domain) throw new Error(`Wrong domain for ${query}: ${result.domain}`);
  if (!result.matched) throw new Error(`Query not matched: ${query}`);
}

const ruh = routeGhaibQuestion('What is the ruh?', 'en');
if (ruh.domain !== 'ruh' || ruh.language !== 'en') throw new Error('Bilingual routing failed');
if (!getEvidenceForDomain('ruh').some(x => x.reference === '17:85')) throw new Error('Ruh Quran evidence missing');

const mahdi = routeGhaibQuestion('المهدي المنتظر', 'ar');
if (!mahdi.requiresHadithVerification) throw new Error('Mahdi must require hadith verification');

console.log('Ghaib evidence router OK');
