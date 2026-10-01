const DEFAULT_SAFETY_MARGIN = 64;

function integer(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

export class OmegaMultimodalContextGuard {
  static plan({
    contextWindow,
    evidenceTokens = 0,
    textTokens = 0,
    requestedVisualTokens = 256,
    reservedGenerationTokens = 256,
    safetyMarginTokens = DEFAULT_SAFETY_MARGIN,
    minimumVisualTokens = 0
  } = {}) {
    const window = integer(contextWindow, 0);
    if (window < 1) throw new RangeError("contextWindow must be positive");

    const evidence = integer(evidenceTokens, 0);
    const text = integer(textTokens, 0);
    const generation = integer(reservedGenerationTokens, 256);
    const safety = integer(safetyMarginTokens, DEFAULT_SAFETY_MARGIN);
    const requestedVisual = integer(requestedVisualTokens, 256);
    const minimumVisual = Math.min(requestedVisual, integer(minimumVisualTokens, 0));

    const reserved = evidence + text + generation + safety;
    const available = Math.max(0, window - reserved);
    const maxVisualTokens = Math.min(requestedVisual, available);

    return Object.freeze({
      context_window_tokens: window,
      evidence_tokens: evidence,
      text_tokens: text,
      reserved_generation_tokens: generation,
      safety_margin_tokens: safety,
      requested_visual_tokens: requestedVisual,
      minimum_visual_tokens: minimumVisual,
      available_visual_tokens: maxVisualTokens,
      evidence_preserved: evidence + text + generation + safety <= window,
      overflow: reserved > window || maxVisualTokens < minimumVisual,
      action: maxVisualTokens >= minimumVisual
        ? "PRUNE_VISUALS_TO_BUDGET"
        : "BLOCK_MULTIMODAL_INPUT"
    });
  }

  static assertEvidencePreserved(plan) {
    if (!plan?.evidence_preserved || plan?.overflow || Number(plan?.available_visual_tokens) < Number(plan?.minimum_visual_tokens)) {
      throw new Error("MULTIMODAL_CONTEXT_EVIDENCE_BUDGET_EXCEEDED");
    }
    return plan;
  }
}

export const OMEGA_MULTIMODAL_CONTEXT_GUARD_VERSION = "1.0.0";
