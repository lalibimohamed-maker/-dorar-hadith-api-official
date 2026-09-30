import test from "node:test";
import assert from "node:assert/strict";
import { verifyAgentAnswer } from "../src/rechercher-omega-answer-verifier.js";

const evidence=[{
 sourceId:"bukhari",
 evidence_id:"h:1",
 citation:"vol.1 p.1",
 kind:"primary_text",
 type:"hadith",
 exact_quote_required:true,
 text:"إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ",
 sha256:"b0282fe41fa1cd9e3224fcf46fbd7180eb6c954396bfcb7b92a858e0220c9c28",
 source:"sahih-bukhari",
 document_id:"bukhari:1",
 rights_status:"cleared",
 provenance:"verified",
 verification_status:"verified",
 authenticity_status:"sahih"
}];
const citations=[{sourceId:"bukhari",citation:"vol.1 p.1",text_hash:"b0282fe41fa1cd9e3224fcf46fbd7180eb6c954396bfcb7b92a858e0220c9c28"}];

test("green path accepts exact primary text",()=>{
 const r=verifyAgentAnswer({answer:"قال رسول الله ﷺ: إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ.",evidence,citations});
 assert.equal(r.verified,true); assert.equal(r.fallback,null);
});

test("red path blocks a one-character/diacritic-altered primary text and falls back",()=>{
 const r=verifyAgentAnswer({answer:"قال رسول الله ﷺ: إنما الأعمال بالنية.",evidence,citations});
 assert.equal(r.verified,false); assert.equal(r.error.code,"STRICT_ALIGNMENT_MISMATCH");
 assert.equal(r.fallback,evidence[0].text);
});

test("black path blocks answers without retrieved evidence",()=>{
 const r=verifyAgentAnswer({answer:"إجابة من ذاكرة النموذج",evidence:[],citations:[]});
 assert.equal(r.verified,false); assert.equal(r.error.code,"NO_EVIDENCE_FOUND"); assert.equal(r.fallback,null);
});

test("stale evidence hash is rejected before trusting a citation",()=>{
 const r=verifyAgentAnswer({
  answer:evidence[0].text,
  evidence:[{...evidence[0],sha256:"0000000000000000000000000000000000000000000000000000000000000000"}],
  citations
 });
 assert.equal(r.verified,false);
 assert.equal(r.error.code,"EVIDENCE_TEXT_HASH_MISMATCH");
});
