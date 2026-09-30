/**
 * Rechercher Ω — Transformers.js strictly-local text generation adapter.
 *
 * The dependency is intentionally loaded dynamically so the server-side API
 * does not acquire browser-only dependencies. The offline application bundle
 * must ship @huggingface/transformers and the model files itself.
 */

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
        .join("\\n");
    }
  }
  if (typeof output?.generated_text === "string") return output.generated_text;
  return "";
}

export async function createTransformersJsLocalGenerator({
  model,
  localModelPath = "/models/",
  device = "wasm",
  dtype = "q4",
  revision = null,
  wasmPaths = null,
  generationOptions = {}
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

  const options = {
    device: device === "webgpu" ? "webgpu" : "wasm",
    dtype,
    local_files_only: true,
    ...generationOptions
  };
  if (revision) options.revision = revision;

  const generator = await pipeline("text-generation", model, options);

  return {
    kind: "transformers-js-local",
    model,
    device: options.device,
    dtype,
    async generate({ query, evidence = [], max_new_tokens = 256 } = {}) {
      const source = evidence.map(item => ({
        source_id: item?.sourceId ?? item?.source_id ?? item?.id ?? null,
        citation: item?.citation ?? null,
        text: item?.text ?? item?.text_raw ?? null
      }));

      const prompt = [
        "Use only the supplied verified evidence.",
        "Do not invent unsupported scholarly claims.",
        "Preserve primary source text exactly.",
        "Evidence:",
        JSON.stringify(source),
        "Question:",
        String(query ?? "")
      ].join("\\n");

      const output = await generator(prompt, {
        max_new_tokens,
        ...generationOptions
      });
      const text = extractGeneratedText(output);
      if (!text) throw new Error("LOCAL_MODEL_EMPTY_OUTPUT");
      return text;
    },
    dispose() {
      generator.dispose?.();
    }
  };
}
