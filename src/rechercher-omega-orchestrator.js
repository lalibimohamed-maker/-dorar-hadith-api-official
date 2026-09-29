/**
 * Rechercher Ω — multimodal orchestration kernel.
 *
 * This layer does NOT generate scholarly truth. It plans work, selects
 * interchangeable model workers, enforces evidence/rights boundaries and
 * records provenance required for reproducible outputs.
 */

const DEFAULT_REGISTRY = new URL("../config/rechercher-omega-model-registry.json", import.meta.url);
const EXECUTABLE_LICENSE_STATUS = "verified_source_license";

export async function loadModelRegistry(url = DEFAULT_REGISTRY) {
  const raw = await readText(url);
  return JSON.parse(raw);
}

async function readText(url) {
  const fs = await import("node:fs/promises");
  return fs.readFile(url, "utf8");
}

const TASK_MODEL_PRIORITY = Object.freeze({
  reasoning: ["qwen3", "gpt-oss", "qwen3-omni"],
  multimodal_understanding: ["qwen3-omni", "qwen3-vl", "paddleocr-vl"],
  document_understanding: ["paddleocr-vl", "qwen3-vl", "qwen3-omni"],
  image_understanding: ["qwen3-vl", "qwen3-omni"],
  video_understanding: ["qwen3-vl", "qwen3-omni"],
  automatic_speech_recognition: ["whisper", "qwen3-omni"],
  speech_translation: ["whisper", "qwen3-omni"],
  text_to_video: ["wan2.2", "hunyuanvideo-1.5", "ltx-2", "cogvideox"],
  image_to_video: ["hunyuanvideo-1.5", "wan2.2", "ltx-2", "cogvideox"],
  audio_video: ["ltx-2", "qwen3-omni"],
  text_to_speech: ["cosyvoice", "kokoro"],
  text_to_image: ["flux"],
  inference_runtime: ["sglang"],
  safety_audit: ["gpt-oss-safeguard"],
  programming: ["qwen3-coder", "gpt-oss", "qwen3"]
});

const SCHOLARLY_TASKS = new Set([
  "scholarly_answer",
  "evidence_synthesis",
  "translation_evidence"
]);

export function isModelRuntimeEligible(model) {
  if (!model || typeof model !== "object") return false;
  if (model.runtime_enabled === false) return false;
  if (model.status === "blocked" || model.status === "research_only") return false;
  return model.license_status === EXECUTABLE_LICENSE_STATUS;
}

export function selectModels(registry, task, { allowed = [], blocked = [] } = {}) {
  const ids = TASK_MODEL_PRIORITY[task] ?? [];
  const allowedSet = new Set(allowed);
  const blockedSet = new Set(blocked);
  const available = new Map((registry.models ?? []).map(model => [model.id, model]));

  return ids
    .filter(id => available.has(id))
    .filter(id => !blockedSet.has(id))
    .filter(id => allowed.length === 0 || allowedSet.has(id))
    .map(id => available.get(id))
    .filter(isModelRuntimeEligible);
}

function findBlockedModels(registry, task, requestedModels = []) {
  const ids = TASK_MODEL_PRIORITY[task] ?? [];
  const requested = requestedModels.length ? new Set(requestedModels) : null;
  const models = (registry.models ?? []).filter(model =>
    ids.includes(model.id) && (!requested || requested.has(model.id)) && !isModelRuntimeEligible(model)
  );
  return models.map(model => ({
    id: model.id,
    license_status: model.license_status ?? "unknown",
    status: model.status ?? "unknown",
    reason: model.license_status !== EXECUTABLE_LICENSE_STATUS
      ? "runtime requires verified_source_license"
      : "model is disabled for runtime"
  }));
}

export function buildPlan(input, registry) {
  const {
    task,
    evidence = [],
    rights_status = "unknown",
    output_kind = "analysis",
    requested_models = [],
    blocked_models = []
  } = input;

  const models = requested_models.length
    ? selectModels(registry, task, { allowed: requested_models, blocked: blocked_models })
    : selectModels(registry, task, { blocked: blocked_models });

  const rejectedModels = findBlockedModels(registry, task, requested_models);

  const plan = {
    schema_version: "1.1.0",
    engine: "rechercher-omega",
    task,
    output_kind,
    models: models.map(m => ({
      id: m.id,
      source: m.source,
      license_review: m.license_review,
      license_status: m.license_status,
      runtime_eligible: true
    })),
    rejected_models: rejectedModels,
    evidence_count: evidence.length,
    rights_status,
    gates: {
      evidence_required: SCHOLARLY_TASKS.has(task),
      rights_required_for_publication: output_kind === "public_media" || output_kind === "public_dataset",
      runtime_license_required: true,
      corpus_write_allowed: false,
      generated_media_is_evidence: false
    }
  };

  if (plan.gates.evidence_required && evidence.length === 0) {
    plan.status = "blocked";
    plan.block_reason = "scholarly task requires explicit evidence records";
    return plan;
  }

  if (plan.gates.rights_required_for_publication && rights_status !== "cleared") {
    plan.status = "blocked";
    plan.block_reason = "public output requires rights_status=cleared";
    return plan;
  }

  if (models.length === 0) {
    plan.status = "blocked";
    plan.block_reason = rejectedModels.length
      ? "registered models exist but none are runtime-eligible"
      : "no registered model worker matches task constraints";
    return plan;
  }

  plan.status = "ready";
  return plan;
}

export function buildCouncilPlan({ evidence = [], task, output_kind = "analysis" }) {
  return {
    schema_version: "1.0.0",
    engine: "rechercher-omega",
    task,
    output_kind,
    roles: ["researcher", "source_auditor", "contrarian", "logic_auditor", "media_critic", "rights_auditor", "synthesizer"],
    independent_review_required: true,
    evidence_count: evidence.length,
    fail_closed: true
  };
}

export function buildTournamentPlan({ task, candidate_models = [], constraints = {} }) {
  return {
    schema_version: "1.0.0",
    engine: "rechercher-omega",
    task,
    candidates: [...new Set(candidate_models)],
    constraints,
    metrics: [
      "task_success",
      "evidence_fidelity",
      "prompt_adherence",
      "temporal_consistency",
      "arabic_text_fidelity",
      "latency_ms",
      "peak_vram_mb",
      "output_size_bytes"
    ],
    selection: "benchmark_results_only"
  };
}

export function createProvenanceRecord({
  plan,
  source_ids = [],
  input_sha256 = null,
  output_sha256 = null,
  model_versions = [],
  prompt_hash = null
}) {
  return {
    schema_version: "1.0.0",
    engine: "rechercher-omega",
    plan_status: plan.status,
    source_ids: [...new Set(source_ids)],
    input_sha256,
    output_sha256,
    model_versions,
    prompt_hash,
    generated_media_is_evidence: false,
    corpus_write: false
  };
}

export function assertOutputBoundary({ plan, provenance }) {
  if (provenance.generated_media_is_evidence) {
    throw new Error("Rechercher Ω boundary violation: generated media cannot be evidence");
  }
  if (provenance.corpus_write) {
    throw new Error("Rechercher Ω boundary violation: generated output cannot write directly to Corpus");
  }
  if (plan.status !== "ready") {
    throw new Error("Rechercher Ω cannot execute a blocked plan");
  }
  return true;
}

/** Build the worldwide source-discovery plan through the canonical Ω generator. */
export async function buildGlobalSourceDiscoveryPlan(input = {}) {
  const { buildGlobalDeepSearchPlan } = await import("./rechercher-omega-global-deep-search.js");
  return buildGlobalDeepSearchPlan(input);
}
