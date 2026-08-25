import test from "node:test";
import assert from "node:assert/strict";
import { authorizeCorpusWrite, isDirectCorpusWriteAllowed, WRITE_DECISIONS } from "../src/corpus-write-boundary.js";
import { CAPABILITY } from "../src/security/security-shield.js";

const refreshCapabilities = [CAPABILITY.CORPUS_WRITE];

test("source refresh can never write directly to Corpus", () => {
  assert.equal(isDirectCorpusWriteAllowed({ capabilities: refreshCapabilities }), false);
});

test("quarantined revision is denied", () => {
  const r = authorizeCorpusWrite({ sourceId:"s", revisionId:"r", state:"quarantined", rights:"link-only", capabilities:refreshCapabilities });
  assert.equal(r.decision, WRITE_DECISIONS.DENY_QUARANTINED);
});

test("missing provenance is denied", () => {
  const r = authorizeCorpusWrite({ state:"changed", rights:"redistributable", capabilities:refreshCapabilities });
  assert.equal(r.decision, WRITE_DECISIONS.DENY_UNVERIFIED);
});

test("missing capability is denied", () => {
  const r = authorizeCorpusWrite({ sourceId:"s", revisionId:"r", state:"changed", rights:"redistributable" });
  assert.equal(r.decision, WRITE_DECISIONS.DENY_DIRECT_CORPUS_WRITE);
});

test("valid changed source enters review queue, never Corpus directly", () => {
  const r = authorizeCorpusWrite({ sourceId:"s", revisionId:"r", state:"changed", rights:"redistributable", capabilities:refreshCapabilities });
  assert.equal(r.decision, WRITE_DECISIONS.ALLOW_REVIEW_QUEUE);
});

test("unexpected writer is denied", () => {
  const r = authorizeCorpusWrite({ sourceId:"s", revisionId:"r", state:"changed", rights:"redistributable", actor:"external-webhook", capabilities:refreshCapabilities });
  assert.equal(r.decision, WRITE_DECISIONS.DENY_DIRECT_CORPUS_WRITE);
});
