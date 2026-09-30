import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { UnsupportedClaimGate } from "../src/rechercher-omega-claim-gate.js";
import { verifyAgentAnswer } from "../src/rechercher-omega-answer-verifier.js";

const source = "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ";
const citation = {
  sourceId:"bukhari",
  citation:"vol.1 p.1",
  text_hash:createHash("sha256").update(source,"utf8").digest("hex")
};
const evidence = [{
  sourceId:"bukhari",
  citation:"vol.1 p.1",
  kind:"primary_text",
  exact_quote_required:true,
  text:source,
  sha256:citation.text_hash,
  verification_status:"verified"
}];

function claimRecord(statement, overrides={}) {
  const normalized = statement.normalize("NFKC").normalize("NFC").replace(/\s+/gu," ").trim();
  const claim_sha256 = createHash("sha256").update(normalized,"utf8").digest("hex");
  return {
    claim_text:normalized,
    claim_sha256,
    verification_status:"verified",
    support_type:"knowledge_graph",
    support_id:"kg:fixture:1",
    citations:[citation],
    ...overrides
  };
}

test("claim gate rejects an unsupported scholarly inference beside an exact source quote",()=>{
  const answer = source + " وهذا يعني أن الحكم الشرعي ثابت في كل صورة بلا استثناء.";
  const result = UnsupportedClaimGate.verifyClaimCoverage(answer,evidence,[]);
  assert.equal(result.ok,false);
  assert.equal(result.rejected[0].reason,"UNSUPPORTED_CLAIM");
});

test("claim gate does not hide a claim merely because the same sentence contains a valid quote",()=>{
  const answer = 'قال رسول الله ﷺ: "' + source + '" وهذا الحديث يدل على وجوب النية في العمل';
  const result = UnsupportedClaimGate.verifyClaimCoverage(answer,evidence,[]);
  assert.equal(result.ok,false);
  assert.equal(result.rejected[0].reason,"UNSUPPORTED_CLAIM");
});

test("claim gate accepts a pre-registered verified knowledge-graph claim tied to retrieved evidence",()=>{
  const statement = "وهذا الحديث يدل على وجوب النية في العمل";
  const result = UnsupportedClaimGate.verifyClaimCoverage(
    source + ". " + statement + ".",
    evidence,
    [claimRecord(statement)]
  );
  assert.equal(result.ok,true);
  assert.equal(result.covered_claim_count,1);
  assert.equal(result.rejected_claim_count,0);
  assert.equal(result.claims[0].support_id,"kg:fixture:1");
});

test("claim gate rejects provenance that points outside the retrieved evidence",()=>{
  const statement = "وهذا الحديث يدل على وجوب النية في العمل";
  const result = UnsupportedClaimGate.verifyClaimCoverage(
    source + ". " + statement + ".",
    evidence,
    [claimRecord(statement,{
      citations:[{sourceId:"outside",citation:"p99"}]
    })]
  );
  assert.equal(result.ok,false);
  assert.equal(result.rejected[0].reason,"CLAIM_CITATION_OUTSIDE_EVIDENCE");
});

test("answer verifier preserves the strict evidence result and exposes claim-level rejection",()=>{
  const answer = 'قال رسول الله ﷺ: "' + source + '". وهذا الحديث يدل على وجوب النية في العمل.';
  const result = verifyAgentAnswer({
    answer,
    evidence,
    citations:[citation]
  });
  assert.equal(result.verified,false);
  assert.equal(result.error.code,"UNSUPPORTED_CLAIM");
  assert.equal(result.verification.ok,true);
  assert.equal(result.claimVerification.ok,false);
  assert.equal(result.fallback,source);
});

test("invalid claim hash cannot self-authorize a scholarly claim",()=>{
  const statement = "وهذا الحديث يدل على وجوب النية في العمل";
  const result = UnsupportedClaimGate.verifyClaimCoverage(
    source + ". " + statement + ".",
    evidence,
    [claimRecord(statement,{claim_sha256:"0".repeat(64)})]
  );
  assert.equal(result.ok,false);
  assert.equal(result.rejected[0].reason,"UNSUPPORTED_CLAIM");
});
