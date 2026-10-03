const GB = 1024 ** 3;
const DEFAULT_MODEL_BUDGET_FRACTION = 0.35;

function safeNonNegative(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function computeEffectiveMemoryCap({
  deviceMemoryGb,
  platformProcessCapBytes = null,
  nativeWebViewCapBytes = null,
  modelBudgetFraction = DEFAULT_MODEL_BUDGET_FRACTION
} = {}) {
  const device = Number(deviceMemoryGb);
  const fraction = Number.isFinite(modelBudgetFraction) && modelBudgetFraction > 0 && modelBudgetFraction <= 1
    ? modelBudgetFraction
    : DEFAULT_MODEL_BUDGET_FRACTION;
  const deviceBytes = Number.isFinite(device) && device > 0 ? device * GB : null;
  const deviceModelCapBytes = deviceBytes == null ? null : Math.floor(deviceBytes * fraction);

  const candidates = [deviceModelCapBytes, platformProcessCapBytes, nativeWebViewCapBytes]
    .filter(value => Number.isSafeInteger(value) && value > 0);

  return candidates.length ? Math.min(...candidates) : null;
}

export function evaluateMemoryAdmission({
  effectiveCapBytes,
  estimatedPeakRamBytes,
  runtimeOverheadBytes = 0,
  indexPeakRamBytes = 0,
  tokenizerRuntimeBytes = 0,
  concurrentBufferBytes = 0,
  safetyMarginBytes = 0
} = {}) {
  const cap = safeNonNegative(effectiveCapBytes);
  const required = safeNonNegative(estimatedPeakRamBytes)
    + safeNonNegative(runtimeOverheadBytes)
    + safeNonNegative(indexPeakRamBytes)
    + safeNonNegative(tokenizerRuntimeBytes)
    + safeNonNegative(concurrentBufferBytes)
    + safeNonNegative(safetyMarginBytes);

  if (!cap) {
    return Object.freeze({
      status: "unknown_cap",
      required_bytes: required,
      effective_cap_bytes: null
    });
  }

  return Object.freeze({
    status: required <= cap ? "fit" : "too_large_for_device",
    required_bytes: required,
    effective_cap_bytes: cap
  });
}
