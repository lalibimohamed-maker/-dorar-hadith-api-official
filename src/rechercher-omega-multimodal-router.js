/**
 * Rechercher Ω — multimodal model fleet router.
 * It selects a model + runtime path but never promotes generated media to evidence
 * and never writes generated output directly into Corpus.
 */

const DEFAULT_FLEET = new URL("../config/rechercher-omega-multimodal-fleet.json", import.meta.url);

export async function loadMultimodalFleet(url = DEFAULT_FLEET) {
  const fs = await import("node:fs/promises");
  return JSON.parse(await fs.readFile(url, "utf8"));
}

export function selectMultimodalModel({
  fleet,
  task,
  availableRuntimes = [],
  requireClearedWeights = true
}) {
  const runtimes = new Set(availableRuntimes);
  const taskCandidates = fleet.models
    .filter(m => m.tasks.includes(task))
    .filter(m => runtimes.size === 0 || m.runtime.some(r => runtimes.has(r)));
  const candidates = taskCandidates
    .filter(m => m.tasks.includes(task))
    .filter(m => runtimes.size === 0 || m.runtime.some(r => runtimes.has(r)))
    .filter(m => !requireClearedWeights || isProductionRuntimeReady(m))
    .sort((a,b) => a.priority - b.priority);

  if (!candidates.length) {
    return {
      status:"queued",
      task,
      reason:requireClearedWeights
        ? "no multimodal model/runtime with cleared license and weights is currently available"
        : "no eligible multimodal model/runtime is currently available",
      blocked_candidates: requireClearedWeights ? taskCandidates.map(m => ({
        id:m.id,
        license_status:m.license_status ?? "unknown",
        weight_status:m.weight_status ?? "unknown",
        next_action: m.storage_status === "weights_present"
          ? "complete_license_dependency_and_e2e_runtime_verification"
          : "acquire_and_verify_weight_artifact"
      })) : [],
      corpus_write_allowed:false,
      generated_media_is_evidence:false
    };
  }

  const model = candidates[0];
  const runtime = model.runtime.find(r => runtimes.size === 0 || runtimes.has(r)) ?? model.runtime[0];
  return {
    status:"ready",
    task,
    model_id:model.id,
    family:model.family,
    runtime,
    license_status:model.license_status,
    weight_status:model.weight_status,
    requires_license_clearance:true,
    corpus_write_allowed:false,
    generated_media_is_evidence:false,
    provenance_required:true
  };
}

export function isProductionRuntimeReady(model) {
  if (model.license_status !== "cleared" || model.weight_status !== "cleared") return false;
  if (model.runtime_status && model.runtime_status !== "ready") return false;
  if (model.execution_proof && model.execution_proof !== "e2e_verified") return false;
  return true;
}

export function buildMultimodalJob({
  fleet,
  task,
  input,
  availableRuntimes = [],
  requireClearedWeights = true
}) {
  const plan = selectMultimodalModel({fleet,task,availableRuntimes,requireClearedWeights});
  return {
    ...plan,
    input_schema: input ?? {},
    output_policy:{
      generated_media_is_evidence:false,
      corpus_write_allowed:false,
      provenance_required:true,
      rights_gate_required:true
    }
  };
}

export function assertMultimodalBoundary(plan) {
  if (plan.corpus_write_allowed) throw new Error("multimodal boundary violation: Corpus writes are forbidden");
  if (plan.generated_media_is_evidence) throw new Error("multimodal boundary violation: generated media cannot be evidence");
  if (plan.status === "ready" && !plan.provenance_required) throw new Error("multimodal boundary violation: provenance is required");
  if (plan.status === "ready" && (plan.license_status !== "cleared" || plan.weight_status !== "cleared")) {
    throw new Error("multimodal boundary violation: production execution requires cleared license and weights");
  }
  return true;
}
