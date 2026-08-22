import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const gate=JSON.parse(fs.readFileSync(path.join(root,"config/corpus-ingestion-gate-2026.json"),"utf8"));
const batch=JSON.parse(fs.readFileSync(path.join(root,"config/corpus-ingestion-batch-04-2026-08-22.json"),"utf8"));

test("corpus gate preserves canonical Quran and translation separation",()=>{
  assert.equal(gate.canonicalRules.quranArabicTextImmutable,true);
  assert.equal(gate.canonicalRules.translationIsMeaningNotOriginal,true);
  assert.equal(gate.canonicalRules.tafsirSeparatedFromQuran,true);
});

test("seed records are pending and attributable",()=>{
  assert.ok(batch.records.length>0);
  for(const r of batch.records){
    assert.ok(r.id); assert.ok(r.source_id); assert.ok(r.provenance);
    assert.notEqual(r.verification_state,"verified");
  }
});

test("seed ids are unique",()=>{
  const ids=batch.records.map(r=>r.id);
  assert.equal(new Set(ids).size,ids.length);
});
