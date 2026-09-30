(() => {
  "use strict";

  const DEFAULTS = Object.freeze({
    patch_size: 14,
    merge_size: 2,
    min_pixels: 56 * 56,
    max_pixels: 28 * 28 * 1280,
    target_visual_tokens: 256,
    max_dimension: 448
  });

  const positive = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  };
  const alignment = profile => Math.max(1, Math.floor(positive(profile?.patch_size, DEFAULTS.patch_size))) *
    Math.max(1, Math.floor(positive(profile?.merge_size, DEFAULTS.merge_size)));
  const estimate = (w, h, profile) => Math.ceil((Math.max(0, Number(w) || 0) * Math.max(0, Number(h) || 0)) / Math.pow(alignment(profile), 2));

  function plan(width, height, runtimeProfile = {}, modelProfile = {}) {
    const profile = { ...DEFAULTS, ...modelProfile };
    const contextPlan = runtimeProfile?.contextWindowTokens && window.OmegaMultimodalContextGuard
      ? window.OmegaMultimodalContextGuard.plan({
          contextWindow: runtimeProfile.contextWindowTokens,
          evidenceTokens: runtimeProfile.evidenceTokens,
          textTokens: runtimeProfile.textTokens,
          requestedVisualTokens: profile.target_visual_tokens,
          reservedGenerationTokens: runtimeProfile.reservedGenerationTokens,
          safetyMarginTokens: runtimeProfile.safetyMarginTokens,
          minimumVisualTokens: runtimeProfile.minimumVisualTokens
        })
      : null;
    if (contextPlan && window.OmegaMultimodalContextGuard?.assertEvidencePreserved) {
      window.OmegaMultimodalContextGuard.assertEvidencePreserved(contextPlan);
    }
    const effectiveProfile = contextPlan ? { ...profile, target_visual_tokens: contextPlan.available_visual_tokens } : profile;
    const align = alignment(effectiveProfile);
    const budget = Math.max(1, Math.floor(positive(effectiveProfile.target_visual_tokens, DEFAULTS.target_visual_tokens)));
    const byTokens = budget * align * align;
    const minPixels = positive(effectiveProfile.min_pixels, DEFAULTS.min_pixels);
    if (minPixels > byTokens) throw new RangeError("VISUAL_BUDGET_BELOW_MODEL_MINIMUM");
    const maxPixels = Math.min(positive(effectiveProfile.max_pixels, DEFAULTS.max_pixels), byTokens);
    const sourceWidth = Math.max(1, Number(width) || 1);
    const sourceHeight = Math.max(1, Number(height) || 1);
    const maxDimension = Math.max(align, Math.floor(positive(
      profile.max_dimension,
      runtimeProfile?.target_runtime === "WASM" ? DEFAULTS.max_dimension / 2 : DEFAULTS.max_dimension
    )));
    const scale = Math.min(1, Math.sqrt(maxPixels / (sourceWidth * sourceHeight)));
    let targetWidth = Math.max(align, Math.floor(sourceWidth * scale / align) * align);
    let targetHeight = Math.max(align, Math.floor(sourceHeight * scale / align) * align);
    while (targetWidth * targetHeight > maxPixels && (targetWidth > align || targetHeight > align)) {
      if (targetWidth / targetHeight >= sourceWidth / sourceHeight && targetWidth > align) targetWidth -= align;
      else if (targetHeight > align) targetHeight -= align;
      else break;
    }
    if (Math.max(targetWidth, targetHeight) > maxDimension) {
      const ratio = maxDimension / Math.max(targetWidth, targetHeight);
      targetWidth = Math.max(align, Math.floor(targetWidth * ratio / align) * align);
      targetHeight = Math.max(align, Math.floor(targetHeight * ratio / align) * align);
    }

    return Object.freeze({
      source: { width: sourceWidth, height: sourceHeight },
      target: { width: targetWidth, height: targetHeight },
      alignment: align,
      max_pixels: maxPixels,
      estimated_visual_tokens: estimate(targetWidth, targetHeight, effectiveProfile),
      target_visual_tokens: budget,
      context_plan: contextPlan
    });
  }

  function prune(canvas, runtimeProfile = {}, modelProfile = {}) {
    if (!canvas || !Number.isFinite(Number(canvas.width)) || !Number.isFinite(Number(canvas.height))) {
      throw new TypeError("canvasElement must expose numeric width and height");
    }
    const result = plan(canvas.width, canvas.height, runtimeProfile, modelProfile);
    const output = document.createElement("canvas");
    output.width = result.target.width;
    output.height = result.target.height;
    const ctx = output.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("CANVAS_2D_CONTEXT_UNAVAILABLE");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(canvas, 0, 0, output.width, output.height);
    return Object.freeze({ canvas: output, plan: result });
  }

  window.OmegaVisualPruner = Object.freeze({
    plan,
    prune,
    estimateVisualTokens: estimate,
    qwen2VisionProfile: overrides => Object.freeze({
      patch_size: 14,
      merge_size: 2,
      min_pixels: 56 * 56,
      max_pixels: 28 * 28 * 1280,
      target_visual_tokens: 256,
      max_dimension: 448,
      ...(overrides || {})
    }),
    version: "1.0.0"
  });
})();
