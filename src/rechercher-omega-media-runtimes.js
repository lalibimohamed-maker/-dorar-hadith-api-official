function assertBoundary(input={}) {
  if (input.corpus_write_allowed === true) throw new Error("media runtime cannot write Corpus");
}
export function buildComfyUIJob({workflow,prompt,endpoint_env="COMFYUI_URL",...input}) {
  assertBoundary(input);
  if (!workflow) throw new Error("ComfyUI job requires an explicit workflow");
  return {runtime:"local-comfyui",mode:"api",endpoint_env,workflow,prompt:prompt??null,credentials:"runtime_injected",network_execution:"runtime_only",corpus_write_allowed:false,generated_media_is_evidence:false};
}
export function buildFFmpegComposition({command,args=[],...input}) {
  assertBoundary(input);
  if (!command) throw new Error("FFmpeg composition requires an explicit command");
  return {runtime:"local-ffmpeg",mode:"process",command,args,corpus_write_allowed:false,generated_media_is_evidence:false,provenance_required:true};
}
export function buildKaggleMediaJob({kernel_slug,command,dataset_refs=[],...input}) {
  assertBoundary(input);
  if (!kernel_slug || !command) throw new Error("Kaggle media job requires kernel_slug and explicit command");
  return {runtime:"kaggle-gpu",mode:"remote_kernel",kernel_slug,command,dataset_refs:[...new Set(dataset_refs)],credentials:"runtime_injected",corpus_write_allowed:false,generated_media_is_evidence:false};
}