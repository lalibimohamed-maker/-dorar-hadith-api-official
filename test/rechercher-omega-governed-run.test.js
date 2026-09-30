[object Object]
test("governed runner rejects unverified evidence before model generation", async () => {
 let providerCalled = false;
 const rejectedEvidence = [{ ...evidence[0], verification_status: "rejected" }];
 const r = await runEvidenceFirstResearch({
  provider: {
   generate: async () => {
    providerCalled = true;
    return { provider: "fixture", model: "fixture", text: evidence[0].text };
   }
  },
  query: "حديث الأعمال بالنيات",
  evidence: rejectedEvidence,
  citations,
  messages: []
 });
 assert.equal(providerCalled, false);
 assert.equal(r.result, null);
 assert.equal(r.verification.error.code, "NO_EVIDENCE_FOUND");
 assert.equal(r.hardGate.accepted.length, 0);
 assert.equal(r.hardGate.rejected.length, 1);
});
