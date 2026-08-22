import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync('data/ghaib/evidence-seed-2026.json','utf8'));
if(data.status!=='verified-seed') throw new Error('Evidence seed status invalid');
if(data.records.length<20) throw new Error('Evidence seed too small');
for(const r of data.records){if(!r.id||!r.domain||!r.sourceType||!r.reference||!r.evidenceClass) throw new Error(`Incomplete evidence record: ${r.id||'unknown'}`);if(r.sourceType==='quran'&&!r.arabic) throw new Error(`Missing Arabic Quran text: ${r.id}`);}
if(!data.records.some(r=>r.domain==='ruh'&&r.reference==='17:85')) throw new Error('Ruh evidence missing');
if(!data.records.some(r=>r.domain==='prophetic_stories'&&r.subtopic==='dhu_al_qarnayn')) throw new Error('Dhu al-Qarnayn evidence missing');
if(!data.records.some(r=>r.domain==='prophetic_stories'&&r.subtopic==='khidr')) throw new Error('Khidr evidence missing');
if(!data.records.some(r=>r.domain==='shaytan'&&r.subtopic==='rajm_al_shayatin')) throw new Error('Shooting-star evidence missing');
console.log('Ghaib evidence seed OK');
