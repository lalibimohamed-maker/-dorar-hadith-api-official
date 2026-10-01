
import { OmegaVisualPruner } from "./omega-visual-pruner.js";
import { OmegaMultimodalContextGuard } from "./omega-multimodal-context-guard.js";

function extractGeneratedText(output) {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    const last = output.at(-1);
    if (typeof last === "string") return last;
    if (typeof last?.generated_text === "string") return last.generated_text;
    if (Array.isArray(last?.generated_text)) {
      return last.generated_text
        .map(item => item?.content ?? item?.text ?? "")
        .filter(Boolean)
        .join("\n");
    }
  }
  if (typeof output?.generated_text === "string") return output.generated_text;
  return "";
}

function evidencePrompt(evidence, query) {
  const source = evidence.map(item => ({
    source_id: item?.sourceId ?? item?.source_id ?? item?.id ?? null,
    citation: item?.citation ?? null,
    text: item?.text ?? item?.text_raw ?? null
  }));
  return [
    "Use only the supplied verified evidence.",
    "Do not invent unsupported scholarly claims.",
    "Preserve primary source text exactly.",
    "Evidence:",
    JSON.stringify(source),
    "Question:",
    String(query ?? "")
  ].join("\n");
}

async function estimateTokens(tokenizer, text) {
  if (!tokenizer || typeof tokenizer !== "function") return 0;
  try {
    const encoded = await tokenizer(String(text ?? ""), { add_special_tokens: false });
    return Number(encoded?.input_ids?.size) ||
      Number(encoded?.input_ids?.dims?.at?.(-1)) ||
      0;
  } catch {
    return 0;
  }
}

function isCanvasLike(value) {
  return Boolean(value &&
    Number.isFinite(Number(value.width)) &&
    Number.isFinite(Number(value.height)) &&
    typeof value.getContext === "function");
}

async function prepareImage(image, {
  runtimeProfile = {},
  modelProfile = {}
} = {}) {
  const width = Number(image?.width);
  const height = Number(image?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error("LOCAL_MULTIMODAL_IMAGE_DIMENSIONS_REQUIRED");
  }

  const plan = OmegaVisualPruner.plan(width, height, runtimeProfile, modelProfile);

  if (isCanvasLike(image)) {
    return {
      image: OmegaVisualPruner.pruneVisualTokens(image, runtimeProfile, modelProfile).canvas,
      plan
    };
  }

  if (typeof image?.resize === "function") {
    const resized = await image.resize(plan.target.width, plan.target.height);
    return { image: resized, plan };
  }

  throw new Error("LOCAL_MULTIMODAL_IMAGE_RESIZER_UNAVAILABLE");
}

async function prepareMultimodalContent(media, {
  runtimeProfile,
  modelProfile
} = {}) {
  const entries = Array.isArray(media) ? media : [media];
  const prepared = [];

  for (const entry of entries.filter(Boolean)) {
    const type = String(entry?.type || "image");
    if (type !== "image") throw new Error("LOCAL_MULTIMODAL_UNSUPPORTED_MEDIA_TYPE:" + type);
    const result = await prepareImage(entry?.image ?? entry, { runtimeProfile, modelProfile });
    prepared.push({ type: "image", image: result.image, plan: result.plan });
  }

  return prepared;
}

export async function createTransformersJsLocalGenerator({
  model,
  localModelPath = "/models/",
  device = "wasm",
  dtype = "q4",
  revision = null,
  wasmPaths = null,
  generationOptions = {},
  task = "text-generation",
  modelProfile = {},
  contextProfile = {}
} = {}) {
  if (!model || typeof model !== "string") {
    throw new TypeError("local Transformers.js model path is required");
  }

  const transformers = await import("@huggingface/transformers");
  const { pipeline, env } = transformers;

  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = localModelPath;
  env.useBrowserCache = true;
  env.useWasmCache = true;
  if (wasmPaths) env.backends.onnx.wasm.wasmPaths = wasmPaths;

  let currentDevice = device === "webgpu" ? "webgpu" : "wasm";
  let currentChunkSize = Math.max(1, Number(contextProfile.chunk_size) || 128);
  let generator = null;
  let switchPromise = null;

  const buildOptions = backend => {
    const options = {
      device: backend === "webgpu" ? "webgpu" : "wasm",
      dtype,
      local_files_only: true,
      ...generationOptions
    };
    if (revision) options.revision = revision;
    return options;
  };

  async function load(backend) {
    const next = await pipeline(task, model, buildOptions(backend));
    const previous = generator;
    generator = next;
    currentDevice = backend === "webgpu" ? "webgpu" : "wasm";
    try { previous?.dispose?.(); } catch {}
    return generator;
  }

  await load(currentDevice);

  async function switchBackend(nextBackend, { chunk_size = currentChunkSize } = {}) {
    const normalized = nextBackend === "webgpu" ? "webgpu" : "wasm";
    currentChunkSize = Math.max(1, Number(chunk_size) || Math.floor(currentChunkSize / 2) || 1);
    if (normalized === currentDevice && generator) return generator;

    switchPromise = switchPromise || load(normalized).finally(() => { switchPromise = null; });
    return switchPromise;
  }

  async function runText(prompt, options = {}) {
    const activeGenerator = generator;
    if (!activeGenerator) throw new Error("LOCAL_MODEL_NOT_INITIALIZED");
    return activeGenerator(prompt, options);
  }

  async function runMultimodal(prompt, media) {
    if (task !== "image-text-to-text") {
      throw new Error("LOCAL_MULTIMODAL_TASK_NOT_CONFIGURED");
    }
    const content = media.map(item => ({ type: "image", image: item.image }));
    content.push({ type: "text", text: prompt });
    const activeGenerator = generator;
    if (!activeGenerator) throw new Error("LOCAL_MODEL_NOT_INITIALIZED");
    return activeGenerator([{ role: "user", content }], {
      max_new_tokens: 256,
      ...generationOptions
    });
  }

  return {
    kind: "transformers-js-local",
    model,
    task,
    get device() { return currentDevice; },
    get chunk_size() { return currentChunkSize; },

    async generate({
      query,
      evidence = [],
      media = [],
      max_new_tokens = 256,
      runtime_profile = {},
      context_profile = {},
      evidence_tokens = null,
      text_tokens = null
    } = {}) {
      const prompt = evidencePrompt(evidence, query);

      if (!media || (Array.isArray(media) && media.length === 0)) {
        const output = await runText(prompt, { max_new_tokens, ...generationOptions });
        const text = extractGeneratedText(output);
        if (!text) throw new Error("LOCAL_MODEL_EMPTY_OUTPUT");
        return text;
      }

      const tokenizer = generator?.tokenizer;
      const estimatedEvidenceTokens = evidence_tokens == null
        ? await estimateTokens(tokenizer, JSON.stringify(evidence))
        : Math.max(0, Number(evidence_tokens) || 0);
      const estimatedTextTokens = text_tokens == null
        ? await estimateTokens(tokenizer, String(query ?? ""))
        : Math.max(0, Number(text_tokens) || 0);

      const mergedContextProfile = { ...contextProfile, ...runtime_profile };
      let contextPlan = null;
      if (Number(mergedContextProfile.context_window_tokens) > 0) {
        contextPlan = OmegaMultimodalContextGuard.plan({
          contextWindow: mergedContextProfile.context_window_tokens,
          evidenceTokens: estimatedEvidenceTokens,
          textTokens: estimatedTextTokens,
          requestedVisualTokens: modelProfile.target_visual_tokens ?? 256,
          reservedGenerationTokens: mergedContextProfile.generation_reservation_tokens ?? max_new_tokens,
          safetyMarginTokens: mergedContextProfile.safety_margin_tokens ?? 64,
          minimumVisualTokens: mergedContextProfile.minimum_visual_tokens ?? 0
        });
        OmegaMultimodalContextGuard.assertEvidencePreserved(contextPlan);
      }

      const effectiveRuntimeProfile = { ...mergedContextProfile };
      const effectiveModelProfile = {
        ...modelProfile,
        ...(contextPlan ? { target_visual_tokens: contextPlan.available_visual_tokens } : {})
      };

      const prepared = await prepareMultimodalContent(media, {
        runtimeProfile: effectiveRuntimeProfile,
        modelProfile: effectiveModelProfile
      });

      let output;
      try {
        output = await runMultimodal(prompt, prepared);
      } catch (error) {
        if (currentDevice !== "wasm") {
          await switchBackend("wasm", { chunk_size: Math.floor(currentChunkSize / 2) || 1 });
          output = await runMultimodal(prompt, prepared);
        } else {
          throw error;
        }
      }

      const text = extractGeneratedText(output);
      if (!text) throw new Error("LOCAL_MODEL_EMPTY_OUTPUT");

      return {
        text,
        backend: currentDevice,
        chunk_size: currentChunkSize,
        task,
        visual_context: {
          items: prepared.map(item => item.plan),
          context_plan: contextPlan
        }
      };
    },

    async switchBackend(nextBackend, options = {}) {
      return switchBackend(nextBackend, options);
    },

    async onBackendLoss(detail = {}) {
      return switchBackend("wasm", {
        chunk_size: detail.suggested_chunk_size || Math.floor(currentChunkSize / 2) || 1
      });
    },

    dispose() {
      try { generator?.dispose?.(); } catch {}
      generator = null;
    }
  };
}
