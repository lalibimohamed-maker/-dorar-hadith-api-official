import { routeGhaibQuestion } from '../src/ghaib-evidence-router.js';

const cases = [
  ['What is the ruh?', 'ruh'],
  ['Who is the Mahdi?', 'eschatology'],
  ['Tell me about Dhu al Qarnayn', 'prophetic_stories'],
  ['What is the Khidr story?', 'prophetic_stories'],
  ['What are the keys of the unseen?', 'unseen_keys'],
  ['What is the Throne?', 'allah'],
  ['How do the celestial bodies orbit?', 'cosmology']
];
for (const [query, expected] of cases) {
  const r = routeGhaibQuestion(query, 'en');
  if (r.domain !== expected) throw new Error(`English routing failed: ${query} => ${r.domain}`);
  if (r.language !== 'en') throw new Error(`Language not preserved: ${query}`);
}
console.log('Ghaib multilingual routing OK');
