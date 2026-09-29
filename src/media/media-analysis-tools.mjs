import path from "node:path";

function assertInputPath(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(field + " is required");
  if (value.includes("\0")) throw new Error(field + " contains an invalid null byte");
  return value;
}

export function buildVmafCommand({
  referencePath,
  distortedPath,
  outputPath,
  model = "model/vmaf_v1.0.16/vmaf_v1.0.16_3d0h.json",
  logPath = null
} = {}) {
  const reference = assertInputPath(referencePath, "referencePath");
  const distorted = assertInputPath(distortedPath, "distortedPath");
  const output = assertInputPath(outputPath, "outputPath");
  const log = logPath == null ? null : assertInputPath(logPath, "logPath");
  const modelOption = model.startsWith("path=") || model.startsWith("version=") ? model : "path=" + model;
  const filter = log
    ? "libvmaf=model=" + modelOption + ":log_fmt=json:log_path=" + log
    : "libvmaf=model=" + modelOption;
  return {
    command: "ffmpeg",
    args: ["-i", distorted, "-i", reference, "-lavfi", filter, "-f", "null", output],
    analysis: "full_reference_vmaf",
    model,
    corpus_write_allowed: false
  };
}

export function buildSceneDetectionCommand({
  inputPath,
  outputDir,
  detector = "detect-adaptive",
  saveImages = false
} = {}) {
  const input = assertInputPath(inputPath, "inputPath");
  const output = assertInputPath(outputDir, "outputDir");
  if (!["detect-content", "detect-adaptive", "detect-threshold", "detect-histogram", "detect-hash"].includes(detector)) {
    throw new Error("unsupported scene detector: " + detector);
  }
  const args = ["-i", input, detector, "list-scenes"];
  if (saveImages) args.push("save-images");
  args.push("-o", output);
  return {
    command: "scenedetect",
    args,
    analysis: "scene_detection",
    detector,
    output_dir: path.resolve(output),
    corpus_write_allowed: false
  };
}
