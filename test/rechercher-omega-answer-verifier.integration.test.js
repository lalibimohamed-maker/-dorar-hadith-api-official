import test from "node:test";
import assert from "node:assert/strict";
import { verifyAgentAnswer } from "../src/rechercher-omega-answer-verifier.js";

const evidence=[{sourceId:"bukhari",citation:"vol.1 p.1",kind:"primary_text",exact_quote_required:true,text:"إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ"}];
const citations=[{sourceId:"bukhari",citation:"vol.1 p.1"}];

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
