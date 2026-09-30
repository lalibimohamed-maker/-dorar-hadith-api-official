import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs";
test("SANA video engines are release-backed and source-independent",()=>{
 const d=JSON.parse(fs.readFileSync("config/rechercher-omega-sana-video-engines-2026.json","utf8"));
 assert.equal(d.engines.length,2); for(const e of d.engines){assert.equal(e.license,"apache-2.0");assert.ok(e.revision);assert.ok(e.release_tag);}
 assert.equal(d.policy.generated_media_is_evidence,false); assert.equal(d.policy.dual_storage_gate_required,true);
});