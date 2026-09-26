export function buildMediaProductionPlan({
  research_case_id, task="educational_video", language="ar", script, storyboard=[],
  assets=[], generation={}, voice={}, subtitles={}, composition={}, runtime="kaggle-gpu"
}) {
  if (!research_case_id) throw new Error("media production requires research_case_id");
  if (!script) throw new Error("media production requires a reviewed script");
  return {
    status:"planned", research_case_id, task, language,
    stages:[
      {id:"research",status:"complete",evidence_boundary:"source_records_only"},
      {id:"script",status:"requires_council",value:script},
      {id:"storyboard",status:"planned",items:storyboard},
      {id:"assets",status:"planned",items:assets},
      {id:"generation",status:"planned",config:generation},
      {id:"voice",status:"planned",config:voice},
      {id:"subtitles",status:"planned",config:subtitles},
      {id:"composition",status:"planned",config:composition}
    ],
    runtime,
    output_policy:{generated_media_is_evidence:false,corpus_write_allowed:false,rights_gate_required:true,provenance_required:true,council_required:true}
  };
}
export function assertMediaProductionBoundary(plan) {
  if (plan.output_policy.corpus_write_allowed) throw new Error("media pipeline cannot write Corpus");
  if (plan.output_policy.generated_media_is_evidence) throw new Error("generated media cannot be evidence");
  if (!plan.output_policy.rights_gate_required || !plan.output_policy.provenance_required) throw new Error("media pipeline requires rights and provenance gates");
  return true;
}