import test from "node:test";
import assert from "node:assert/strict";
import { OmegaMultimodalContextGuard } from "../packages/omega-browser/src/omega-multimodal-context-guard.js";

test("multimodal context reserves evidence before assigning visual budget", () => {
  const plan = OmegaMultimodalContextGuard.plan({
    contextWindow: 2048,
    evidenceTokens: 1000,
    textTokens: 300,
    requestedVisualTokens: 1024,
    reservedGenerationTokens: 512,
    safetyMarginTokens: 64
  });
  assert.equal(plan.available_visual_tokens, 172);
  assert.equal(plan.evidence_preserved, true);
  assert.equal(plan.action, "PRUNE_VISUALS_TO_BUDGET");
});

test("multimodal input is blocked when evidence and output reservations exceed context", () => {
  const plan = OmegaMultimodalContextGuard.plan({
    contextWindow: 1024,
    evidenceTokens: 800,
    textTokens: 100,
    requestedVisualTokens: 256,
    reservedGenerationTokens: 128,
    safetyMarginTokens: 64,
    minimumVisualTokens: 64
  });
  assert.equal(plan.overflow, true);
  assert.equal(plan.action, "BLOCK_MULTIMODAL_INPUT");
  assert.throws(() => OmegaMultimodalContextGuard.assertEvidencePreserved(plan), /MULTIMODAL_CONTEXT_EVIDENCE_BUDGET_EXCEEDED/);
});

test("guard does not claim a universal tokenization rule", () => {
  const plan = OmegaMultimodalContextGuard.plan({ contextWindow: 4096, evidenceTokens: 500, textTokens: 200 });
  assert.equal(plan.requested_visual_tokens, 256);
});
