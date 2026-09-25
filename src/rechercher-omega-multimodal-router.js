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
  requireClearedWeights = false
}) {
  const runtimes = new Set(availableRuntimes);
  const candidates = fleet.models
    .filter(m => m.tasks.includes(task))
    .filter(m => runtimes.size === 0 || m.runtime.some(r => runtimes.has(r)))
    .filter(m => !requireClearedWeights || (m.license_status === "cleared" && m.weight_status === "cleared"))
    .sort((a,b) => a.priority - b.priority);

  if (!candidates.length) {
    return {
      status:"queued",
      task,
      reason:"no eligible multimodal model/runtime is currently available",
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

export function buildMultimodalJob({
  fleet,
  task,
  input,
  availableRuntimes = [],
  requireClearedWeights = false
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
  return true;
}
