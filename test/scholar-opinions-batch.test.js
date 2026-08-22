import test from "node:test";
import assert from "node:assert/strict";
import { buildScholarOpinionBatch } from "../src/scholar-opinions-batch.js";

test("scholar-opinions batch discovers registered scholars without auto-verification", () => {
  const batch = buildScholarOpinionBatch({ offset: 0, limit: 5 });
  assert.equal(batch.returned, 5);
  assert.equal(batch.autoPromotionToVerified, false);
  assert.equal(batch.officialSourceTargetsEnabled, true);
  assert.ok(batch.batches.every((item) => item.searchTasks.length > 0));
  assert.ok(batch.batches.every((item) => item.requiredFields.includes("sourceUrl")));
});

test("scholar-opinions batch exposes official source URLs when registered", () => {
  const batch = buildScholarOpinionBatch({ query: "عبد العزيز بن عبد الله بن باز", limit: 5 });
  assert.ok(batch.batches.some((item) => item.sourceTargets.some((source) => source.url === "https://binbaz.org.sa/fatwas")));
  assert.ok(batch.batches.every((item) => item.searchTasks.every((task) => task.verification === "unverified")));
});

test("scholar-opinions batch supports targeted scholar search", () => {
  const batch = buildScholarOpinionBatch({ query: "ابن تيمية", limit: 5 });
  assert.ok(batch.batches.some((item) => item.subjectScholarId === "ibn-taymiyyah"));
});
