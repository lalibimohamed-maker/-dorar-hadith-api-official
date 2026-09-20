import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const p=path.join(process.cwd(),'config/rechercher/islamic-source-adapters-2026.json');
const r=JSON.parse(fs.readFileSync(p,'utf8'));

test('preserves the original six Rechercher Islamic sources',()=>{
  const ids=new Set(r.adapters.map(x=>x.id));
  for(const id of ['hadeethenc','islamhouse','islamhouse-cdn','quranenc','quran-com','quran-api']) assert.ok(ids.has(id),id);
});

test('adds the six requested Islamic source adapters',()=>{
  const ids=new Set(r.adapters.map(x=>x.id));
  for(const id of ['sunnah-com','hadith-api','alquran-cloud','qul','house-of-islam','kalimat']) assert.ok(ids.has(id),id);
});

test('AI/search providers remain discovery tools and never become religious source text',()=>{
  const kalimat=r.adapters.find(x=>x.id==='kalimat');
  assert.equal(kalimat.ai_role,'semantic_discovery_only');
  assert.equal(kalimat.source_role,'discovery_cross_reference_only');
  assert.equal(kalimat.machine_translation,false);
  assert.equal(r.policy.ai_is_not_a_religious_source,true);
  assert.equal(r.policy.ai_generated_translation_is_never_promoted,true);
});

test('credential-gated providers are registered without pretending they are public',()=>{
  assert.equal(r.adapters.find(x=>x.id==='sunnah-com').api_auth,'required_for_api');
  assert.equal(r.adapters.find(x=>x.id==='hadith-api').api_auth,'required');
  assert.equal(r.adapters.find(x=>x.id==='kalimat').api_auth,'required');
});

test('all registered origins are HTTPS and uniquely owned by their adapter',()=>{
  const seen=new Set();
  for(const a of r.adapters){
    for(const origin of a.origins){
      assert.ok(origin.startsWith('https://'),origin);
      assert.ok(!seen.has(origin),`duplicate origin: ${origin}`);
      seen.add(origin);
    }
  }
});
