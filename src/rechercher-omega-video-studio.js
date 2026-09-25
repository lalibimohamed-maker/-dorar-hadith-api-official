/**
 * Rechercher Ω — deterministic video studio planner.
 *
 * Turns a council-reviewed research case + script into scene-level
 * generation/editing jobs. Scholarly evidence remains source-bound;
 * generated visuals are presentation assets only.
 */

const VISUAL_TASKS = new Set([
  "text_to_video",
  "image_to_video",
  "text_to_image",
  "image_editing",
  "video_to_video",
  "ocr",
  "document_understanding"
]);

function assertScene(scene, index) {
  if (!scene || typeof scene !== "object") throw new Error(`scene ${index} must be an object`);
  if (!scene.scene_id) throw new Error(`scene ${index} requires scene_id`);
  if (!Array.isArray(scene.evidence_ids) || scene.evidence_ids.length === 0) {
    throw new Error(`scene ${scene.scene_id} requires at least one evidence_ids`);
  }
  if (!scene.visual_mode) throw new Error(`scene ${scene.scene_id} requires visual_mode`);
}

export function buildVideoStudioPlan({
  research_case_id,
  script,
  scenes=[],
  language="ar",
  aspect_ratio="16:9",
  fps=24,
  default_duration_seconds=6,
  availableRuntimes=["kaggle-gpu","local"],
  requireClearedWeights=false
}) {
  if (!research_case_id) throw new Error("video studio requires research_case_id");
  if (!script) throw new Error("video studio requires a reviewed script");
  if (!Array.isArray(scenes) || !scenes.length) throw new Error("video studio requires at least one scene");

  scenes.forEach(assertScene);
  const normalized = scenes.map((scene, index) => ({
    scene_id: scene.scene_id,
    order: index + 1,
    duration_seconds: scene.duration_seconds ?? default_duration_seconds,
    narration: scene.narration ?? "",
    evidence_ids: [...new Set(scene.evidence_ids)],
    visual_mode: scene.visual_mode,
    prompt: scene.prompt ?? "",
    negative_prompt: scene.negative_prompt ?? "",
    source_assets: scene.source_assets ?? [],
    generation_task: scene.generation_task ?? (
      scene.visual_mode === "image_to_video" ? "image_to_video" :
      scene.visual_mode === "video_to_video" ? "video_to_video" :
      scene.visual_mode === "image" ? "text_to_image" :
      scene.visual_mode === "source_asset" ? "source_asset" : "text_to_video"
    ),
    model_preferences: scene.model_preferences ?? [],
    runtime_preferences: scene.runtime_preferences ?? availableRuntimes,
    subtitles: scene.subtitles ?? null,
    provenance: {
      evidence_ids: [...new Set(scene.evidence_ids)],
      generated_media_is_evidence: false,
      provenance_required: true
    }
  }));

  const jobs = normalized.map(scene => ({
    scene_id: scene.scene_id,
    task: scene.generation_task,
    required: VISUAL_TASKS.has(scene.generation_task),
    input: {
      prompt: scene.prompt,
      negative_prompt: scene.negative_prompt,
      source_assets: scene.source_assets,
      language
    },
    model_preferences: scene.model_preferences,
    runtime_preferences: scene.runtime_preferences,
    requireClearedWeights,
    output_policy: {
      generated_media_is_evidence:false,
      corpus_write_allowed:false,
      rights_gate_required:true,
      provenance_required:true
    }
  }));

  return {
    status:"planned",
    research_case_id,
    language,
    format:{aspect_ratio,fps},
    script:{review_status:"requires_council",value:script},
    scenes:normalized,
    jobs,
    composition:{
      strategy:"ordered_scene_timeline",
      audio:"narration_then_licensed_music",
      subtitles:"per_scene",
      transition_policy:"deterministic"
    },
    output_policy:{
      generated_media_is_evidence:false,
      corpus_write_allowed:false,
      rights_gate_required:true,
      provenance_required:true,
      council_required:true
    }
  };
}

export function assertVideoStudioBoundary(plan) {
  if (plan.output_policy.corpus_write_allowed) throw new Error("video studio cannot write Corpus");
  if (plan.output_policy.generated_media_is_evidence) throw new Error("generated video cannot be evidence");
  if (!plan.output_policy.rights_gate_required || !plan.output_policy.provenance_required) {
    throw new Error("video studio requires rights and provenance gates");
  }
  for (const scene of plan.scenes ?? []) {
    if (!scene.provenance?.evidence_ids?.length) throw new Error(`scene ${scene.scene_id} lost evidence provenance`);
    if (scene.provenance.generated_media_is_evidence) throw new Error(`scene ${scene.scene_id} marks generated media as evidence`);
  }
  return true;
}

export function buildScenePrompt({topic, evidence_summary, visual_goal, language="ar"}) {
  if (!topic || !visual_goal) throw new Error("scene prompt requires topic and visual_goal");
  return [
    `Language: ${language}`,
    `Topic: ${topic}`,
    `Evidence summary (context only; do not invent facts): ${evidence_summary ?? ""}`,
    `Visual goal: ${visual_goal}`,
    "Do not render unverifiable quotations, citations, manuscript text, or factual claims as if they were source evidence.",
    "Use generated imagery only as explanatory presentation material."
  ].join("\n");
}
