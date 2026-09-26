/**
 * Rechercher Ω — free-first execution routing.
 *
 * This router chooses an execution backend; it never treats an API/model
 * response as scholarly evidence and never writes generated output to Corpus.
 */

const DEFAULT_BACKENDS = new URL("../config/rechercher-omega-execution-backends.json", import.meta.url);

export async function loadExecutionBackends(url = DEFAULT_BACKENDS) {
  const fs = await import("node:fs/promises");
  return JSON.parse(await fs.readFile(url, "utf8"));
}

export function selectExecutionBackend({
  backends,
  task,
  model,
  capabilities = {},
  availableBackends = [],
  preferFree = true
}) {
  const allowed = new Set(availableBackends);
  const candidates = backends.backends
    .filter(b => allowed.size === 0 || allowed.has(b.id))
    .filter(b => !preferFree || b.free === true)
    .filter(b => capabilities.requires_gpu ? b.requires_gpu === true || b.kind === "remote_gpu" : true)
    .sort((a, b) => a.priority - b.priority);

  if (candidates.length === 0) {
    return {
      status: "queued",
      reason: "no eligible execution backend is currently available",
      task,
      model,
      corpus_write_allowed: false,
      generated_media_is_evidence: false
    };
  }

  const selected = candidates[0];
  return {
    status: "ready",
    task,
    model,
    backend: selected.id,
    backend_kind: selected.kind,
    provider: selected.provider ?? null,
    free: selected.free === true,
    requires_api_key: selected.requires_api_key === true,
    weights_required: selected.weights_required === true,
    corpus_write_allowed: false,
    generated_media_is_evidence: false
  };
}

export function assertExecutionBoundary(plan) {
  if (plan.corpus_write_allowed) {
    throw new Error("Rechercher Ω execution boundary violation: Corpus writes are forbidden");
  }
  if (plan.generated_media_is_evidence) {
    throw new Error("Rechercher Ω execution boundary violation: generated media cannot be evidence");
  }
  return true;
}

export async function executeSelectedBackend(plan, input = {}) {
  assertExecutionBoundary(plan);
  if (plan.status !== "ready") throw new Error("Rechercher Ω cannot execute a non-ready plan");
  const adapters = await import("./rechercher-omega-adapters.js");
  const payload = { ...input, corpus_write_allowed: false, generated_media_is_evidence: false };
  if (plan.backend === "gemini-free-tier") return adapters.executeGemini({ model: plan.model, ...payload });
  if (plan.backend === "groq-free-plan") return adapters.executeGroq({ model: plan.model, ...payload });
  if (plan.backend === "huggingface-inference") return adapters.executeHuggingFace({ model: plan.model, ...payload });
  if (plan.backend === "local") return adapters.executeLocal(payload);
  if (plan.backend === "kaggle-gpu") return adapters.buildKaggleExecution(payload);
  throw new Error("unsupported Rechercher Ω backend: " + plan.backend);
}
