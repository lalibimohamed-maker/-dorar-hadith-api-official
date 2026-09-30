import test from "node:test";
import assert from "node:assert/strict";
import { runEvidenceFirstResearch } from "../src/rechercher-omega-governed-run.js";
test("evidence-first runner normalizes, verifies, and never writes Corpus",async()=>{
 const r=await runEvidenceFirstResearch({
  provider:{generate:async({query})=>({provider:"fixture",model:"fixture",text:query})},
  query:" إِنَّ اللهَ، غفورٌ؟ ",
  evidence:[{sourceId:"book-1",citation:"p.1",text:"نص"}],
  citations:[{sourceId:"book-1",citation:"p.1"}],
  claims:[{topic:"x",value:"A"},{topic:"x",value:"B"}],
  messages:[]
 });
 assert.equal(r.query.normalized,"ان الله غفور"); assert.equal(r.verification.ok,true); assert.equal(r.conflicts[0].status,"conflict"); assert.equal(r.corpusWrite,false);
});
