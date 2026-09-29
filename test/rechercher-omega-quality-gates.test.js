import test from "node:test";
import assert from "node:assert/strict";
import { evaluateVideoQuality, evaluateAnswerQuality, assertQualityGate } from "../src/rechercher-omega-quality-gates.js";

test("video quality gate fails closed when reference metrics are incomplete", () => {
  const result = evaluateVideoQuality({ metrics: { vmaf: 90 } });
  assert.equal(result.status, "blocked");
  assert.ok(result.missing.includes("ssim"));
});

test("video quality gate accepts a measured high-quality output", () => {
  const result = evaluateVideoQuality({ metrics: { vmaf: 92, ssim: 0.98, subtitle_drift_ms: 40 } });
  assert.equal(result.status, "passed");
  assert.doesNotThrow(() => assertQualityGate(result));
});

test("answer quality gate blocks unsupported scholarly claims", () => {
  const result = evaluateAnswerQuality({ metrics: { unsupported_claims: 1, citation_coverage: 1 } });
  assert.equal(result.status, "blocked");
});

test("answer quality gate requires complete evidence metrics", () => {
  const result = evaluateAnswerQuality({ metrics: { unsupported_claims: 0 } });
  assert.equal(result.status, "blocked");
});
