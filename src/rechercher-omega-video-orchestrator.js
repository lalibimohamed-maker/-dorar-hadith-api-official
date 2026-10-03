/**
 * Rechercher Omega - executable video orchestration planner.
 * Plans runtime execution without network calls or Corpus writes.
 */
import { selectMultimodalModel } from "./rechercher-omega-multimodal-router.js";
import { buildComfyUIJob, buildKaggleMediaJob, buildFFmpegComposition, buildLocalVideoEngineJob } from "./rechercher-omega-media-runtimes.js";
import { createJob, assertJobBoundary } from "./rechercher-omega-job-control.js";
import { buildTelemetryContext } from "./rechercher-omega-observability.js";
import { admitExecution } from "./rechercher-omega-resource-admission.js";
import { buildSemanticCacheKey, isCacheReusable } from "./rechercher-omega-semantic-cache.js";

export function orchestrateVideoPlan({
  studioPlan,
  fleet,
  runtimeConfig,
  requireClearedWeights = true,
  resourceObservations = {},
  cacheEntries = {}
}) {
  if (!studioPlan?.scenes?.length) throw new Error("video orchestration requires a studio plan");
  if (studioPlan.output_policy?.corpus_write_allowed) throw new Error("video orchestration cannot write Corpus");
  const runtimeIds = new Set((runtimeConfig?.runtimes ?? []).map(r => r.id));
  const pools = runtimeConfig?.resourcePools ?? {};

  const jobs = studioPlan.scenes.map(scene => {
    if (scene.generation_task === "source_asset") {
      const job = createJob({
        kind: "media:source-asset",
        payload: {
          research_case_id: studioPlan.research_case_id,
          scene_id: scene.scene_id,
          evidence_ids: scene.evidence_ids,
          source_assets: scene.source_assets ?? []
        },
        revision: "1.1.0"
      });
      assertJobBoundary(job);
      return {
        scene_id: scene.scene_id,
        status: "source_asset",
        evidence_ids: scene.evidence_ids,
        runtime_job: job,
        telemetry: buildTelemetryContext({
          workflow: "omega.media.source_asset",
          task: "source_asset",
          job_id: job.job_id
        }),
        output_policy: {
          corpus_write_allowed: false,
          generated_media_is_evidence: false,
          provenance_required: true,
          quality_gate_required: true,
          quality_gate: "rechercher-omega-quality-gates-2026"
        }
      };
    }

    const available = (scene.runtime_preferences ?? []).filter(r => runtimeIds.has(r));
    const selection = selectMultimodalModel({
      fleet,
      task: scene.generation_task,
      availableRuntimes: available,
      requireClearedWeights
    });

    const modelId = selection.model_id ?? selection.model?.id ?? null;
    const modelRevision = scene.model_revision ?? selection.model_revision ?? "unknown";
    const cacheKey = buildSemanticCacheKey({
      task: scene.generation_task,
      model: modelId,
      modelRevision,
      prompt: scene.prompt ?? "",
      evidence: scene.evidence ?? scene.evidence_ids ?? [],
      generationConfig: scene.generation_config ?? {},
      language: studioPlan.language ?? "ar"
    });
    const cached = cacheEntries[scene.scene_id];
    const cacheHit = isCacheReusable(cached, cacheKey);

    const result = {
      scene_id: scene.scene_id,
      status: cacheHit ? "cache_hit" : selection.status,
      selection,
      evidence_ids: scene.evidence_ids,
      cache: { key: cacheKey, hit: cacheHit },
      input: {
        prompt: scene.prompt,
        negative_prompt: scene.negative_prompt,
        source_assets: scene.source_assets,
        language: studioPlan.language
      },
      execution: null
    };

    if (cacheHit) return result;
    if (selection.status !== "ready") return result;

    const pool = pools[selection.runtime];
    const observation = resourceObservations[scene.scene_id] ?? {};
    if (pool) {
      const admission = admitExecution({
        pool,
        currentJobs: observation.currentJobs ?? 0,
        currentVramMb: observation.currentVramMb ?? 0,
        requiredVramMb: observation.requiredVramMb ?? scene.required_vram_mb ?? 0
      });
      result.resource_admission = admission;
      if (admission.status !== "admitted") {
        result.status = "queued";
        return result;
      }
    }

    result.execution = buildRuntimeJob(selection.runtime, scene, selection);
    const job = createJob({
      kind: "media:generation",
      payload: {
        research_case_id: studioPlan.research_case_id,
        scene_id: scene.scene_id,
        task: scene.generation_task,
        model: modelId,
        model_revision: modelRevision,
        runtime: selection.runtime,
        cache_key: cacheKey,
        prompt_hash_input: scene.prompt ?? "",
        source_assets: scene.source_assets ?? [],
        evidence_ids: scene.evidence_ids
      },
      revision: modelRevision
    });
    assertJobBoundary(job);
    result.runtime_job = job;
    result.telemetry = buildTelemetryContext({
      workflow: "omega.media.generation",
      task: scene.generation_task,
      model_id: modelId,
      backend: selection.runtime,
      job_id: job.job_id
    });
    return result;
  });

  const composition = buildFFmpegComposition({
    command: "ffmpeg",
    args: ["<ordered-scene-inputs>", "<narration>", "<subtitles>", "<licensed-music>", "<final-output>"]
  });
  const compositionJob = createJob({
    kind: "media:composition",
    payload: {
      research_case_id: studioPlan.research_case_id,
      scene_ids: studioPlan.scenes.map(scene => scene.scene_id),
      format: studioPlan.format,
      composition_strategy: "ordered_scene_timeline"
    },
    revision: "ffmpeg-composition-1.1.0"
  });
  assertJobBoundary(compositionJob);
  composition.runtime_job = compositionJob;
  composition.telemetry = buildTelemetryContext({
    workflow: "omega.media.composition",
    task: "media_composition",
    backend: "ffmpeg",
    job_id: compositionJob.job_id
  });

  return {
    status: jobs.every(j => ["ready", "source_asset", "cache_hit"].includes(j.status)) ? "ready" : "queued",
    research_case_id: studioPlan.research_case_id,
    jobs,
    composition,
    execution_contract: {
      deterministic_jobs: true,
      quality_gate: "rechercher-omega-quality-gates-2026",
      idempotency_key_field: "idempotency_key",
      retryable_states: ["retryable"],
      terminal_states: ["succeeded", "cancelled", "dead_letter"],
      cancellation_supported: true
    },
    output_policy: {
      corpus_write_allowed: false,
      generated_media_is_evidence: false,
      rights_gate_required: true,
      provenance_required: true,
      quality_gate_required: true
    }
  };
}

function buildRuntimeJob(runtime, scene, selection = {}) {
  if (["hunyuanvideo-1.5", "ltx-2"].includes(selection.model_id) && ["local", "kaggle-gpu"].includes(runtime)) {
    return buildLocalVideoEngineJob({

    engineId: selection.model_id,
    modelRevision: selection.model_revision ?? scene.model_revision,
    runtimeEnvironmentId: selection.runtime_environment_id,
    task: scene.generation_task,
    prompt: scene.prompt,
    sourceAssets: scene.source_assets ?? []
  });
  if (runtime === "local-comfyui") return buildComfyUIJob({
    workflow: scene.comfyui_workflow ?? "REQUIRED_RUNTIME_WORKFLOW",
    prompt: scene.prompt
  });
  if (runtime === "kaggle-gpu") return buildKaggleMediaJob({
    kernel_slug: scene.kaggle_kernel_slug ?? "REQUIRED_KAGGLE_KERNEL",
    command: scene.kaggle_command ?? "REQUIRED_KAGGLE_COMMAND",
    dataset_refs: scene.dataset_refs ?? []
  });
  return {
    runtime,
    mode: "model_inference",
    network_execution: "runtime_only",
    credentials: "runtime_injected",
    corpus_write_allowed: false,
    generated_media_is_evidence: false,
    provenance_required: true
  };
}
