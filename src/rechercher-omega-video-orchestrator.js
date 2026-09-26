/**
 * Rechercher Omega - executable video orchestration planner.
 * Plans runtime execution without network calls or Corpus writes.
 */
import { selectMultimodalModel } from "./rechercher-omega-multimodal-router.js";
import { buildComfyUIJob, buildKaggleMediaJob, buildFFmpegComposition } from "./rechercher-omega-media-runtimes.js";

export function orchestrateVideoPlan({studioPlan, fleet, runtimeConfig, requireClearedWeights=true}) {
  if (!studioPlan?.scenes?.length) throw new Error("video orchestration requires a studio plan");
  if (studioPlan.output_policy?.corpus_write_allowed) throw new Error("video orchestration cannot write Corpus");
  const runtimeIds = new Set((runtimeConfig?.runtimes ?? []).map(r => r.id));

  const jobs = studioPlan.scenes.map(scene => {
    if (scene.generation_task === "source_asset") {
      return {scene_id:scene.scene_id,status:"source_asset",evidence_ids:scene.evidence_ids,
        output_policy:{corpus_write_allowed:false,generated_media_is_evidence:false,provenance_required:true}};
    }
    const available = (scene.runtime_preferences ?? []).filter(r => runtimeIds.has(r));
    const selection = selectMultimodalModel({
      fleet, task:scene.generation_task, availableRuntimes:available, requireClearedWeights
    });
    return {
      scene_id:scene.scene_id,status:selection.status,selection,evidence_ids:scene.evidence_ids,
      input:{prompt:scene.prompt,negative_prompt:scene.negative_prompt,source_assets:scene.source_assets,language:studioPlan.language},
      execution:selection.status === "ready" ? buildRuntimeJob(selection.runtime, scene) : null
    };
  });

  const composition = buildFFmpegComposition({
    command:"ffmpeg",
    args:["<ordered-scene-inputs>","<narration>","<subtitles>","<licensed-music>","<final-output>"]
  });

  return {
    status:jobs.every(j => j.status === "ready" || j.status === "source_asset") ? "ready" : "queued",
    research_case_id:studioPlan.research_case_id, jobs, composition,
    output_policy:{corpus_write_allowed:false,generated_media_is_evidence:false,rights_gate_required:true,provenance_required:true}
  };
}

function buildRuntimeJob(runtime, scene) {
  if (runtime === "local-comfyui") return buildComfyUIJob({
    workflow:scene.comfyui_workflow ?? "REQUIRED_RUNTIME_WORKFLOW", prompt:scene.prompt
  });
  if (runtime === "kaggle-gpu") return buildKaggleMediaJob({
    kernel_slug:scene.kaggle_kernel_slug ?? "REQUIRED_KAGGLE_KERNEL",
    command:scene.kaggle_command ?? "REQUIRED_KAGGLE_COMMAND",
    dataset_refs:scene.dataset_refs ?? []
  });
  return {runtime,mode:"model_inference",network_execution:"runtime_only",credentials:"runtime_injected",
    corpus_write_allowed:false,generated_media_is_evidence:false,provenance_required:true};
}
