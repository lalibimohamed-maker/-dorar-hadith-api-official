import { OmegaMultimodalContextGuard } from "./omega-multimodal-context-guard.js";

const DEFAULTS = Object.freeze({
  patch_size: 14,
  merge_size: 2,
  min_pixels: 56 * 56,
  max_pixels: 28 * 28 * 1280,
  target_visual_tokens: 256,
  max_dimension: 448,
  min_dimension: 28
});

function finitePositive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function alignment(profile) {
  const patch = Math.max(1, Math.floor(finitePositive(profile?.patch_size, DEFAULTS.patch_size)));
  const merge = Math.max(1, Math.floor(finitePositive(profile?.merge_size, DEFAULTS.merge_size)));
  return patch * merge;
}

function estimateVisualTokens(width, height, profile = {}) {
  const align = alignment(profile);
  const mergedPatchArea = align * align;
  const pixels = Math.max(0, Number(width) || 0) * Math.max(0, Number(height) || 0);
  return Math.ceil(pixels / mergedPatchArea);
}

function assertCanvasLike(canvas) {
  if (!canvas || !Number.isFinite(Number(canvas.width)) || !Number.isFinite(Number(canvas.height))) {
    throw new TypeError("canvasElement must expose numeric width and height");
  }
}

function targetPixelsForBudget(profile) {
  const align = alignment(profile);
  const budget = Math.max(1, Math.floor(finitePositive(profile?.target_visual_tokens, DEFAULTS.target_visual_tokens)));
  const byTokens = budget * align * align;
  const maxPixels = finitePositive(profile?.max_pixels, DEFAULTS.max_pixels);
  const minPixels = finitePositive(profile?.min_pixels, DEFAULTS.min_pixels);
  return Math.max(minPixels, Math.min(maxPixels, byTokens));
}

function dimensionsForPixelBudget(width, height, maxPixels, align, maxDimension) {
  const sourceWidth = Math.max(1, Number(width));
  const sourceHeight = Math.max(1, Number(height));
  const scale = Math.min(1, Math.sqrt(maxPixels / (sourceWidth * sourceHeight)));
  let targetWidth = Math.max(align, Math.round(sourceWidth * scale / align) * align);
  let targetHeight = Math.max(align, Math.round(sourceHeight * scale / align) * align);

  while (targetWidth * targetHeight > maxPixels && (targetWidth > align || targetHeight > align)) {
    if (targetWidth / targetHeight >= sourceWidth / sourceHeight && targetWidth > align) targetWidth -= align;
    else if (targetHeight > align) targetHeight -= align;
    else break;
  }

  if (maxDimension && Math.max(targetWidth, targetHeight) > maxDimension) {
    const dimensionScale = maxDimension / Math.max(targetWidth, targetHeight);
    targetWidth = Math.max(align, Math.floor(targetWidth * dimensionScale / align) * align);
    targetHeight = Math.max(align, Math.floor(targetHeight * dimensionScale / align) * align);
  }

  return Object.freeze({ width: targetWidth, height: targetHeight });
}

export class OmegaVisualPruner {
  static plan(width, height, runtimeProfile = {}, modelProfile = {}) {
    const profile = { ...DEFAULTS, ...modelProfile };
    const contextPlan = runtimeProfile?.contextWindowTokens
      ? OmegaMultimodalContextGuard.plan({
          contextWindow: runtimeProfile.contextWindowTokens,
          evidenceTokens: runtimeProfile.evidenceTokens,
          textTokens: runtimeProfile.textTokens,
          requestedVisualTokens: profile.target_visual_tokens,
          reservedGenerationTokens: runtimeProfile.reservedGenerationTokens,
          safetyMarginTokens: runtimeProfile.safetyMarginTokens,
          minimumVisualTokens: runtimeProfile.minimumVisualTokens
        })
      : null;
    if (contextPlan) OmegaMultimodalContextGuard.assertEvidencePreserved(contextPlan);
    const effectiveProfile = contextPlan
      ? { ...profile, target_visual_tokens: contextPlan.available_visual_tokens }
      : profile;
    const align = alignment(effectiveProfile);
    const maxPixels = targetPixelsForBudget(effectiveProfile);
    const maxDimension = Math.max(align, Math.floor(finitePositive(
      modelProfile.max_dimension,
      runtimeProfile?.target_runtime === "WASM" ? DEFAULTS.max_dimension / 2 : DEFAULTS.max_dimension
    )));
    const dimensions = dimensionsForPixelBudget(width, height, maxPixels, align, maxDimension);
    const estimatedTokens = estimateVisualTokens(dimensions.width, dimensions.height, profile);

    return Object.freeze({
      source: { width: Number(width), height: Number(height) },
      target: dimensions,
      alignment: align,
      max_pixels: maxPixels,
      estimated_visual_tokens: estimatedTokens,
      target_visual_tokens: Math.max(1, Math.floor(finitePositive(effectiveProfile.target_visual_tokens, DEFAULTS.target_visual_tokens))),
      context_plan: contextPlan,
      preserves_aspect_ratio: Math.abs((dimensions.width / dimensions.height) - (Number(width) / Number(height))) < 0.05
    });
  }

  static pruneVisualTokens(canvasElement, runtimeProfile = {}, modelProfile = {}) {
    assertCanvasLike(canvasElement);
    const plan = this.plan(canvasElement.width, canvasElement.height, runtimeProfile, modelProfile);

    if (typeof document === "undefined" || typeof document.createElement !== "function") {
      throw new Error("DOM_CANVAS_FACTORY_UNAVAILABLE");
    }

    const output = document.createElement("canvas");
    output.width = plan.target.width;
    output.height = plan.target.height;

    const context = output.getContext?.("2d", { alpha: true });
    if (!context) throw new Error("CANVAS_2D_CONTEXT_UNAVAILABLE");

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(canvasElement, 0, 0, output.width, output.height);

    return Object.freeze({
      canvas: output,
      plan
    });
  }

  static estimateVisualTokens(width, height, modelProfile = {}) {
    return estimateVisualTokens(width, height, { ...DEFAULTS, ...modelProfile });
  }

  static qwen2VisionProfile(overrides = {}) {
    return Object.freeze({
      patch_size: 14,
      merge_size: 2,
      min_pixels: 56 * 56,
      max_pixels: 28 * 28 * 1280,
      target_visual_tokens: 256,
      max_dimension: 448,
      ...overrides
    });
  }
}

export const OMEGA_VISUAL_PRUNER_VERSION = "1.0.0";
