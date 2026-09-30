import test from "node:test";
import assert from "node:assert/strict";
import { runEvidenceFirstResearch } from "../src/rechercher-omega-governed-run.js";

const evidence=[{
 sourceId:"bukhari",evidence_id:"h:1",citation:"vol.1 p.1",kind:"primary_text",type:"hadith",
 exact_quote_required:true,text:"إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ",sha256:"b0282fe41fa1cd9e3224fcf46fbd7180eb6c954396bfcb7b92a858e0220c9c28",
 source:"sahih-bukhari",document_id:"bukhari:1",rights_status:"cleared",provenance:"verified",
 verification_status:"verified",authenticity_status:"sahih"
}];
const citations=[{sourceId:"bukhari",citation:"vol.1 p.1",text_hash:"b0282fe41fa1cd9e3224fcf46fbd7180eb6c954396bfcb7b92a858e0220c9c28"}];

test("evidence-first runner passes exact source-backed output",async()=>{
 const r=await runEvidenceFirstResearch({
  provider:{generate:async()=>({provider:"fixture",model:"fixture",text:"قال رسول الله ﷺ: إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ."})},
  query:" إِنَّ اللهَ، غفورٌ؟ ",evidence,citations,claims:[{topic:"x",value:"A"},{topic:"x",value:"B"}],messages:[]
 });
 assert.equal(r.query.normalized,"ان الله غفور"); assert.equal(r.verification.verified,true); assert.equal(r.result.provider,"fixture"); assert.equal(r.corpusWrite,false);
});

test("evidence-first runner falls back when the model alters cited source text",async()=>{
 const r=await runEvidenceFirstResearch({
  provider:{generate:async()=>({provider:"fixture",model:"fixture",text:"قال رسول الله ﷺ: إنما الأعمال بالنية."})},
  query:"حديث الأعمال بالنيات",evidence,citations,messages:[]
 });
 assert.equal(r.verification.verified,false); assert.equal(r.verification.error.code,"STRICT_ALIGNMENT_MISMATCH"); assert.equal(r.result,null); assert.equal(r.fallback,evidence[0].text); assert.equal(r.corpusWrite,false);
});

test("evidence-first runner blocks absent evidence before accepting model output",async()=>{
 const r=await runEvidenceFirstResearch({
  provider:{generate:async()=>({provider:"fixture",model:"fixture",text:"إجابة من الذاكرة"})},
  query:"سؤال بلا مستند",evidence:[],citations:[],messages:[]
 });
 assert.equal(r.verification.verified,false); assert.equal(r.verification.error.code,"NO_EVIDENCE_FOUND"); assert.equal(r.result,null); assert.equal(r.fallback,null);
});


test("governed runner can retrieve evidence through a GraphRAG-compatible retriever",async()=>{
 const r=await runEvidenceFirstResearch({
  provider:{generate:async({evidence})=>({provider:"fixture",model:"fixture",text:evidence[0].text})},
  query:"حديث الأعمال بالنيات",
  retriever:{search:async q=>[{
   sourceId:"bukhari",evidence_id:"h:1",citation:"vol.1 p.1",kind:"primary_text",type:"hadith",
   exact_quote_required:true,text:"إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ",sha256:"b0282fe41fa1cd9e3224fcf46fbd7180eb6c954396bfcb7b92a858e0220c9c28",
   source:"sahih-bukhari",document_id:"bukhari:1",rights_status:"cleared",provenance:"verified",
   verification_status:"verified",authenticity_status:"sahih",retrieved_for:q
  }]},
  citations:[{sourceId:"bukhari",citation:"vol.1 p.1",text_hash:"b0282fe41fa1cd9e3224fcf46fbd7180eb6c954396bfcb7b92a858e0220c9c28"}],
  messages:[]
 });
 assert.equal(r.retrievedEvidence.length,1); assert.equal(r.verification.verified,true); assert.equal(r.result.provider,"fixture");
});
