import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const registry=JSON.parse(fs.readFileSync(
  new URL("../config/quran-country-origin-source-registry-2026-09-22.json",import.meta.url),
  "utf8"
));

test("country-origin Quran registry separates discovery from acquisition and rights",()=>{
  assert.equal(registry.policy.canonical_arabic_separate,true);
  assert.equal(registry.policy.ai_generated_translation_forbidden,true);
  assert.equal(registry.policy.corpus_write_forbidden,true);
  assert.equal(registry.sources.length,7);

  const countries=new Set(registry.sources.map(x=>x.country));
  for(const code of ["BD","TR","ID","MA","MY","IR","SA"]) assert.ok(countries.has(code));

  for(const source of registry.sources){
    assert.ok(source.official_url.startsWith("https://"));
    assert.ok(source.discovery_urls.length>0);
    assert.equal(source.edition_status,"discovery_target");
    assert.equal(source.rights_status,"pending");
    assert.equal(source.text_integrity_status,"pending");
  }
});
