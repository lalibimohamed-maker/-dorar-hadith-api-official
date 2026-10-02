import path from "node:path";
import { createQwen3ASRProvider } from "./qwen3-asr-provider.js";
import { selectRunnableVoiceEngine } from "./voice-engine-selector.js";

const QWEN_ENGINE_IDS = new Set([
  "qwen3-asr-0.6b",
  "qwen3-asr-1.7b",
]);

function assertInstalledModelPath(modelPath, { modelRoot = null } = {}) {
  if (!modelPath) throw new TypeError("modelPath is required");
  const resolved = path.resolve(String(modelPath));
  if (!modelRoot) return resolved;

  const root = path.resolve(String(modelRoot));
  const relative = path.relative(root, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("modelPath is outside the approved local model root");
  }
  return resolved;
}

export function createAlHudaLocalASRRuntime({
  modelPath,
  modelRoot = null,
  lowPower = false,
  preferred = [],
  releaseTag = "rechercher-voice-runtime-2026-10",
  python = "python3",
  runnerPath = "scripts/qwen3-asr-runner.py",
  timeoutMs = 120_000,
  selector = selectRunnableVoiceEngine,
  providerFactory = createQwen3ASRProvider,
} = {}) {
  const installedModelPath = assertInstalledModelPath(modelPath, { modelRoot });
  const selection = selector({
    capability: "asr",
    lowPower,
    preferred,
    releaseTag,
  });

  if (!QWEN_ENGINE_IDS.has(selection.engine.id)) {
    throw new Error("selected Al-Huda ASR engine is not Qwen3");
  }
  if (selection.runnable !== true || selection.release?.runtimeVerified !== true) {
    throw new Error("selected Al-Huda ASR Release is not runtime-verified");
  }

  const provider = providerFactory({
    modelPath: installedModelPath,
    python,
    runnerPath,
    timeoutMs,
  });

  if (!provider || typeof provider.execute !== "function") {
    throw new TypeError("Qwen3 provider factory must return an executable provider");
  }

  async function transcribe({ audioPath, language = null } = {}) {
    return provider.execute({ audioPath, language });
  }

  return Object.freeze({
    assistant: "Al-Huda",
    localFirst: true,
    remoteImplicit: false,
    engine: selection.engine,
    release: selection.release,
    releaseRuntimeVerified: true,
    modelPath: installedModelPath,
    supports: provider.supports.bind(provider),
    transcribe,
  });
}
