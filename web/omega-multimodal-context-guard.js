(() => {
  "use strict";

  const integer = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
  };

  function plan(input = {}) {
    const window = integer(input.contextWindow, 0);
    if (window < 1) throw new RangeError("contextWindow must be positive");
    const evidence = integer(input.evidenceTokens, 0);
    const text = integer(input.textTokens, 0);
    const generation = integer(input.reservedGenerationTokens, 256);
    const safety = integer(input.safetyMarginTokens, 64);
    const requested = integer(input.requestedVisualTokens, 256);
    const minimum = Math.min(requested, integer(input.minimumVisualTokens, 0));
    const reserved = evidence + text + generation + safety;
    const available = Math.max(0, window - reserved);
    const visual = Math.min(requested, available);
    return Object.freeze({
      context_window_tokens: window,
      evidence_tokens: evidence,
      text_tokens: text,
      reserved_generation_tokens: generation,
      safety_margin_tokens: safety,
      requested_visual_tokens: requested,
      minimum_visual_tokens: minimum,
      available_visual_tokens: visual,
      evidence_preserved: reserved <= window,
      overflow: reserved > window || visual < minimum,
      action: visual >= minimum ? "PRUNE_VISUALS_TO_BUDGET" : "BLOCK_MULTIMODAL_INPUT"
    });
  }

  window.OmegaMultimodalContextGuard = Object.freeze({
    plan,
    assertEvidencePreserved(value) {
      if (!value?.evidence_preserved || value?.overflow || Number(value?.available_visual_tokens) < Number(value?.minimum_visual_tokens)) {
        throw new Error("MULTIMODAL_CONTEXT_EVIDENCE_BUDGET_EXCEEDED");
      }
      return value;
    },
    version: "1.0.0"
  });
})();
