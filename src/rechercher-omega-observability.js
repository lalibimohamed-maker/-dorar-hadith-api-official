import { randomUUID } from "node:crypto";

export function buildTelemetryContext({
  workflow,
  task,
  model_id = null,
  provider = null,
  backend = null,
  job_id = null,
  trace_id = null,
  span_id = null
} = {}) {
  if (!workflow || !task) throw new TypeError("workflow and task are required");
  return {
    trace_id: trace_id ?? randomUUID(),
    span_id: span_id ?? randomUUID(),
    workflow,
    task,
    model_id,
    provider,
    backend,
    job_id,
    privacy: {
      raw_prompt_recorded: false,
      raw_user_query_recorded: false,
      tool_arguments_recorded: false,
      sensitive_content_opt_in_only: true
    }
  };
}

export function completeTelemetry(context, {
  status,
  queue_wait_ms = null,
  latency_ms = null,
  input_tokens = null,
  output_tokens = null,
  media_bytes_in = null,
  media_bytes_out = null,
  peak_vram_mb = null,
  cache_hit = null,
  error_type = null,
  provenance_id = null
} = {}) {
  if (!context?.trace_id || !context?.span_id) throw new TypeError("telemetry context is required");
  return {
    ...context,
    status: status ?? "unknown",
    queue_wait_ms,
    latency_ms,
    input_tokens,
    output_tokens,
    media_bytes_in,
    media_bytes_out,
    peak_vram_mb,
    cache_hit,
    error_type,
    provenance_id,
    recorded_at: new Date().toISOString()
  };
}

export function assertTelemetryPrivacy(event) {
  for (const forbidden of ["prompt","raw_prompt","user_query","raw_user_query","secret","api_key","token_value"]) {
    if (Object.prototype.hasOwnProperty.call(event ?? {}, forbidden)) {
      throw new Error("telemetry contains a forbidden raw/sensitive field: " + forbidden);
    }
  }
  return true;
}
