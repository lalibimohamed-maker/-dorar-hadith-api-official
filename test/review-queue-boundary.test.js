import test from "node:test";
import assert from "node:assert/strict";
import { canEnterCorpus, createReviewItem, decideReview } from "../src/review-queue-boundary.js";

const hash = "a".repeat(64);

test("complete provenance creates a pending review", () => {
  const item = createReviewItem({sourceId:"s1",revisionId:"r1",contentHash:hash,rights:"redistributable"});
  assert.equal(item.state,"pending");
  assert.equal(canEnterCorpus(item),false);
});

test("non-redistributable content cannot be approved", () => {
  const item = createReviewItem({sourceId:"s2",revisionId:"r2",contentHash:hash,rights:"link-only"});
  assert.throws(() => decideReview(item,{decision:"approved",reviewer:"reviewer",reason:"ok"}));
});

test("approval requires reviewer and reason", () => {
  const item = createReviewItem({sourceId:"s3",revisionId:"r3",contentHash:hash,rights:"redistributable"});
  assert.throws(() => decideReview(item,{decision:"approved"}));
});

test("only an approved redistributable item may enter Corpus", () => {
  const item = createReviewItem({sourceId:"s4",revisionId:"r4",contentHash:hash,rights:"redistributable"});
  const approved = decideReview(item,{decision:"approved",reviewer:"reviewer",reason:"verified provenance and rights",decidedAt:"2026-08-24T00:00:00Z"});
  assert.equal(canEnterCorpus(approved),true);
});

test("rejected items cannot enter Corpus", () => {
  const item = createReviewItem({sourceId:"s5",revisionId:"r5",contentHash:hash,rights:"redistributable"});
  const rejected = decideReview(item,{decision:"rejected",reviewer:"reviewer",reason:"insufficient evidence"});
  assert.equal(canEnterCorpus(rejected),false);
});
