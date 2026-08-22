import test from "node:test";
import assert from "node:assert/strict";
import registry from "../data/scholars/registry.json" with { type: "json" };
import { searchScholars, buildScholarResearchProfile } from "../src/scholar-research.js";

test("expanded scholar registry is populated and evidence-gated", () => {
  assert.ok(registry.records.length >= 100);
  assert.ok(registry.records.some((item) => item.name_ar === "أبو بكر الجزائري"));
  assert.ok(registry.records.some((item) => item.name_ar === "القاضي عياض"));
  assert.ok(registry.records.some((item) => item.name_ar === "محمد يوسف الكاندهلوي"));
  assert.ok(registry.records.some((item) => item.name_ar === "مكي بن أبي طالب القيسي"));
  assert.ok(registry.records.every((item) => item.status === "candidate"));
  assert.ok(registry.records.every((item) => item.verification === "pending"));
});

test("scholar search exposes catalog candidates without turning discovery into attribution", () => {
  const results = searchScholars("ابن تيمية", { limit: 10 });
  assert.ok(results.some((item) => item.nameAr === "أحمد بن تيمية"));
  const profile = buildScholarResearchProfile("ibn_taymiyyah");
  assert.equal(profile.identity.catalogStatus, "candidate");
  assert.equal(profile.identity.verification, "pending");
});
