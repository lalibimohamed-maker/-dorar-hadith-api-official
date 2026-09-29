/**
 * Governed media enhancement planners.
 * These create bounded FFmpeg plans; they do not execute arbitrary shell.
 */
function requiredString(value, field) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw new TypeError(field + " is required");
  return value;
}
function finiteNumber(value, field) {
  if (!Number.isFinite(value)) throw new TypeError(field + " must be finite");
  return value;
}

export function buildLoudnessNormalizationCommand({
  inputPath,
  outputPath,
  integratedLufs = -16,
  truePeakDb = -1.5,
  loudnessRange = 11
} = {}) {
  const input = requiredString(inputPath, "inputPath");
  const output = requiredString(outputPath, "outputPath");
  finiteNumber(integratedLufs, "integratedLufs");
  finiteNumber(truePeakDb, "truePeakDb");
  finiteNumber(loudnessRange, "loudnessRange");
  const filter = `loudnorm=I=${integratedLufs}:TP=${truePeakDb}:LRA=${loudnessRange}`;
  return {
    command: "ffmpeg",
    args: ["-i", input, "-af", filter, output],
    analysis: "ebu-r128-compatible-loudness-normalization",
    corpus_write_allowed: false
  };
}

export function buildFrameSignatureCommand({
  inputPath,
  outputPath = "-",
  fps = 1,
  width = 320
} = {}) {
  const input = requiredString(inputPath, "inputPath");
  const output = requiredString(outputPath, "outputPath");
  if (!Number.isFinite(fps) || fps <= 0 || fps > 60) throw new RangeError("fps must be > 0 and <= 60");
  if (!Number.isInteger(width) || width < 64 || width > 1920) throw new RangeError("width is out of range");
  return {
    command: "ffmpeg",
    args: ["-i", input, "-vf", `fps=${fps},scale=${width}:-2:flags=bicubic`, "-f", "framemd5", output],
    analysis: "deterministic-frame-signature",
    corpus_write_allowed: false
  };
}

export function evaluateSubtitleTiming({ observedDriftMs, maxDriftMs = 120 } = {}) {
  if (!Number.isFinite(observedDriftMs) || observedDriftMs < 0) throw new RangeError("observedDriftMs must be non-negative");
  if (!Number.isFinite(maxDriftMs) || maxDriftMs < 0) throw new RangeError("maxDriftMs must be non-negative");
  return {
    status: observedDriftMs <= maxDriftMs ? "passed" : "blocked",
    observed_drift_ms: observedDriftMs,
    max_drift_ms: maxDriftMs,
    failure: observedDriftMs <= maxDriftMs ? null : "subtitle_drift_exceeded"
  };
}
