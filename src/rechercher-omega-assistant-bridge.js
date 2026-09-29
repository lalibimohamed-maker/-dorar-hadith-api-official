/**
 * Rechercher Ω — governed assistant bridge.
 *
 * Search supplies evidence; Omega supplies the execution plan and backend.
 * Generated answers remain derived output and never write to Corpus.
 */
import { buildPlan, createProvenanceRecord, loadModelRegistry } from "./rechercher-omega-orchestrator.js";
import { buildRuntimeGate, assertRuntimeGate } from "./rechercher-omega-runtime-gate.js";
import { loadExecutionBackends, selectExecutionBackend, executeSelectedBackend } from "./rechercher-omega-execution-router.js";
import { buildTelemetryContext, completeTelemetry } from "./rechercher-omega-observability.js";
import { buildEvidenceEnvelope, buildScholarlySystemPrompt } from "./rechercher-omega-evidence-envelope.js";
import { ConversationMemory } from "./rechercher-omega-conversation-memory.js";

import { admitExecution } from "./rechercher-omega-resource-admission.js";
import { buildSemanticCacheKey, createCacheEntry, isCacheReusable, DEFAULT_CACHE_TTLS_MS } from "./rechercher-omega-semantic-cache.js";

export async function runGovernedAssistantTurn({
  query,
  evidence = [],
  language = "ar",
  output_kind = "analysis",
  requested_models = [],
  blocked_models = [],
  availableBackends = [],
  backendHealth = {},
  execute = false,
  registry = null,
  backends = null,
  search_context = {},
  resourcePool = null,
  currentJobs = 0,
  currentVramMb = 0,
  requiredVramMb = 0,
  cacheEntry = null,
  cacheWriter = null,
  conversationHistory = []
} = {}) {
  if (!String(query ?? "").trim()) throw new TypeError("assistant query is required");

  const modelRegistry = registry ?? await loadModelRegistry();
  const backendRegistry = backends ?? await loadExecutionBackends();

  const plan = buildPlan({
    task: "scholarly_answer",
    evidence,
    rights_status: search_context.rights_status ?? "unknown",
    output_kind,
    requested_models,
    blocked_models
  }, modelRegistry);

  if (plan.status !== "ready") {
    return { status: "blocked", plan, corpus_write_allowed: false };
  }

  const selectedModel = plan.models[0];
  const backend = selectExecutionBackend({
    backends: backendRegistry,
    task: "scholarly_answer",
    model: selectedModel.id,
    availableBackends,
    backendHealth,
    preferFree: true
  });

  const gate = buildRuntimeGate({
    registry: modelRegistry,
    task: "scholarly_answer",
    model: selectedModel.id,
    availableBackends,
    backendHealth
  });
  assertRuntimeGate(gate);

  const provenance = createProvenanceRecord({
    plan,
    source_ids: evidence.map(item => item?.source_id ?? item?.id).filter(Boolean),
    model_versions: [selectedModel.id]
  });

  const cacheKey = buildSemanticCacheKey({
    task: "scholarly_answer",
    model: selectedModel.id,
    modelRevision: selectedModel.starter_revision ?? selectedModel.revision ?? "unknown",
    prompt: String(query).trim(),
    evidence,
    language
  });

  const telemetryContext = buildTelemetryContext({
    workflow: "omega.assistant.turn",
    task: "scholarly_answer",
    model_id: selectedModel.id,
    provider: backend.provider ?? null,
    backend: backend.backend ?? null
  });

  if (cacheEntry && isCacheReusable(cacheEntry, cacheKey)) {
    return {
      status: "cache_hit",
      plan,
      backend,
      gate,
      provenance,
      cache: { hit: true, key: cacheKey, entry: cacheEntry },
      telemetry: completeTelemetry(telemetryContext, { status: "cache_hit", cache_hit: true }),
      corpus_write_allowed: false,
      quality_gate_required: true,
      quality_gate: "rechercher-omega-quality-gates-2026"
    };
  }

  if (!execute) {
    return {
      status: backend.status,
      plan,
      backend,
      gate,
      provenance,
      cache: { hit: false, key: cacheKey, ttl_ms: DEFAULT_CACHE_TTLS_MS.scholarly_answer },
      telemetry: completeTelemetry(telemetryContext, { status: backend.status, cache_hit: false }),
      corpus_write_allowed: false,
      quality_gate_required: true,
      quality_gate: "rechercher-omega-quality-gates-2026"
    };
  }

  if (resourcePool) {
    const admission = admitExecution({
      pool: resourcePool,
      currentJobs,
      currentVramMb,
      requiredVramMb
    });
    if (admission.status !== "admitted") {
      return {
        status: "queued",
        plan,
        backend,
        gate,
        provenance,
        resource_admission: admission,
        cache: { hit: false, key: cacheKey },
        telemetry: completeTelemetry(telemetryContext, { status: "queued", cache_hit: false, error_type: admission.reason }),
        corpus_write_allowed: false,
        quality_gate_required: true,
        quality_gate: "rechercher-omega-quality-gates-2026"
      };
    }
  }

  if (backend.status !== "ready") {
    return {
      status: "queued",
      plan,
      backend,
      gate,
      provenance,
      cache: { hit: false, key: cacheKey },
      telemetry: completeTelemetry(telemetryContext, { status: "queued", cache_hit: false }),
      corpus_write_allowed: false,
      quality_gate_required: true,
      quality_gate: "rechercher-omega-quality-gates-2026"
    };
  }

  const memory = new ConversationMemory({ maxTurns: 20, maxCharsPerMessage: 12000 });
  for (const turn of Array.isArray(conversationHistory) ? conversationHistory : []) {
    if (turn && typeof turn === "object") {
      try { memory.append({ role: turn.role, content: String(turn.content ?? ""), metadata: { source: "client-history" } }); } catch {}
    }
  }
  const history = memory.snapshot();
  const evidenceEnvelope = buildEvidenceEnvelope(evidence);
  const started = Date.now();
  const result = await executeSelectedBackend(gate, {
    messages: [
      {
        role: "system",
        content: [
          "You are Rechercher Ω.",
          buildScholarlySystemPrompt(language).split("\n").slice(1).join("\n")
        ].join("\n")
      },
      {
        role: "user",
        content: [String(query).trim(), evidenceText ? "Evidence:\n" + evidenceText : ""].filter(Boolean).join("\n\n")
      }
    ],
    corpus_write_allowed: false,
    generated_media_is_evidence: false
  });

  const cache = createCacheEntry({
    key: cacheKey,
    outputRef: result?.output_ref ?? null,
    outputSha256: result?.output_sha256 ?? null,
    provenanceId: provenance.input_sha256 ?? null,
    ttlMs: DEFAULT_CACHE_TTLS_MS.scholarly_answer
  });
  if (typeof cacheWriter === "function") await cacheWriter(cache);

  return {
    status: "succeeded",
    plan,
    backend: gate,
    result,
    provenance,
    cache: { hit: false, key: cacheKey, entry: cache },
    telemetry: completeTelemetry(telemetryContext, {
      status: "succeeded",
      latency_ms: Date.now() - started,
      cache_hit: false,
      provenance_id: provenance.input_sha256 ?? null
    }),
    corpus_write_allowed: false,
    quality_gate_required: true,
    quality_gate: "rechercher-omega-quality-gates-2026"
  };
}
