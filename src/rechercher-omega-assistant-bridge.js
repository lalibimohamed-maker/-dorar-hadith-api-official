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
import { sha256 } from "./rechercher-omega-redis-memory.js";
import { verifyAgentAnswer } from "./rechercher-omega-answer-verifier.js";
import { evaluateRuntimeArtifactReadiness } from "./rechercher-omega-runtime-readiness.js";

import { admitExecution } from "./rechercher-omega-resource-admission.js";
import { buildSemanticCacheKey, createCacheEntry, isCacheReusable, DEFAULT_CACHE_TTLS_MS } from "./rechercher-omega-semantic-cache.js";


const SCHOLARLY_TASKS = new Set(["scholarly_answer","evidence_synthesis","translation_evidence"]);

function extractGeneratedText(result) {
  if (typeof result?.text === "string") return result.text;
  if (typeof result?.output_text === "string") return result.output_text;
  const choice = result?.choices?.[0];
  if (typeof choice?.message?.content === "string") return choice.message.content;
  if (Array.isArray(choice?.message?.content)) {
    return choice.message.content.map(part => part?.text ?? "").filter(Boolean).join("\n");
  }
  const candidate = result?.candidates?.[0]?.content?.parts;
  if (Array.isArray(candidate)) return candidate.map(part => part?.text ?? "").filter(Boolean).join("\n");
  if (typeof result?.stdout === "string") return result.stdout;
  return "";
}

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
  conversationHistory = [],
  runtimeArtifact = null,
  sessionId = null,
  distributedMemory = null,
  requireDistributedMemory = false,
  executor = executeSelectedBackend
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

  const runtimeReadiness = evaluateRuntimeArtifactReadiness({
    backendWeightsRequired: backend.weights_required === true,
    artifactState: runtimeArtifact?.state ?? "not_verified",
    sha256Verified: runtimeArtifact?.sha256_verified === true,
    revisionVerified: runtimeArtifact?.revision_verified === true,
    licenseVerified: runtimeArtifact?.license_verified === true
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
      runtime_readiness: runtimeReadiness,
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

  if (runtimeReadiness.status !== "ready") {
    return {
      status: "queued",
      plan,
      backend,
      gate,
      provenance,
      runtime_readiness: runtimeReadiness,
      cache: { hit: false, key: cacheKey },
      telemetry: completeTelemetry(telemetryContext, {
        status: "queued",
        cache_hit: false,
        error_type: "runtime_artifact_not_ready"
      }),
      corpus_write_allowed: false,
      quality_gate_required: true,
      quality_gate: "rechercher-omega-quality-gates-2026"
    };
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

  const hasDistributedMemory = Boolean(sessionId && distributedMemory);
  if (requireDistributedMemory && !sessionId) {
    throw new TypeError("sessionId is required when distributed memory is mandatory");
  }
  let distributedMemoryState = hasDistributedMemory ? "configured" : "volatile_only";
  const distributedEvidenceIds = evidence
    .map(item => item?.source_id ?? item?.sourceId ?? item?.id ?? item?.node_id ?? item?.hadith_id)
    .filter(Boolean)
    .slice(0, 50);

  if (hasDistributedMemory) {
    try {
      if (typeof distributedMemory.ping === "function" && !(await distributedMemory.ping())) {
        throw new Error("REDIS_PING_FAILED");
      }
      await distributedMemory.appendDigest({
        sessionId,
        role: "user",
        content: String(query).trim(),
        evidenceIds: distributedEvidenceIds,
        verified: false
      });
    } catch (error) {
      distributedMemoryState = "unavailable";
      if (requireDistributedMemory) {
        return {
          status: "blocked",
          reason: "distributed_memory_unavailable",
          error: { code: "REDIS_MEMORY_UNAVAILABLE", message: error.message },
          corpus_write_allowed: false,
          generatedMediaIsEvidence: false
        };
      }
    }
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
  if (typeof executor !== "function") throw new TypeError("executor must be a function");
  const result = await executor(gate, {
    messages: [
      {
        role: "system",
        content: [
          buildScholarlySystemPrompt(language)
        ].join("\n")
      },
      {
        role: "user",
        content: [
          history.length ? "Bounded conversation context (volatile):\n" + JSON.stringify(history) : "",
          "Current user query:\n" + String(query).trim(),
          evidenceEnvelope
        ].filter(Boolean).join("\n\n")
      }
    ],
    corpus_write_allowed: false,
    generated_media_is_evidence: false,
    runtimeArtifact
  });

  const generatedText = extractGeneratedText(result);
  const citations = evidence
    .filter(item => item?.source_id && (item?.citation || item?.provenance?.citation))
    .map(item => ({
      sourceId: item.source_id,
      citation: item.citation ?? item.provenance.citation,
      ...(item.text_hash ? { text_hash: item.text_hash } : {})
    }));
  if (SCHOLARLY_TASKS.has(plan.task)) {
    const verification = verifyAgentAnswer({
      answer: generatedText,
      evidence: evidence.map(item => ({
        ...item,
        sourceId: item.source_id ?? item.id,
        citation: item.citation ?? item.provenance?.citation,
        kind: item.kind,
        exact_quote_required: item.exact_quote_required
      })),
      citations
    });

    if (hasDistributedMemory) {
      try {
        await distributedMemory.appendDigest({
          sessionId,
          role: "assistant",
          content: generatedText,
          evidenceIds: distributedEvidenceIds,
          outputSha256: sha256(generatedText),
          verified: verification.verified === true
        });
        distributedMemoryState = "persisted";
      } catch (error) {
        distributedMemoryState = "append_failed";
        if (requireDistributedMemory) {
          return {
            status: "blocked",
            plan,
            backend: gate,
            provenance,
            runtime_readiness: runtimeReadiness,
            verification,
            result: null,
            fallback: verification.verified ? null : verification.fallback,
            error: { code: "REDIS_MEMORY_UNAVAILABLE", message: error.message },
            corpus_write_allowed: false,
            generatedMediaIsEvidence: false,
            distributed_memory: { state: distributedMemoryState, session_id: sessionId }
          };
        }
      }
    }
    if (!verification.verified) {
      return {
        status: "blocked",
        plan,
        backend: gate,
        provenance,
        runtime_readiness: runtimeReadiness,
        verification,
        result: null,
        fallback: verification.fallback,
        distributed_memory: { state: distributedMemoryState, session_id: sessionId },
        telemetry: completeTelemetry(telemetryContext, {
          status: "blocked",
          cache_hit: false,
          error_type: verification.error?.code ?? "EVIDENCE_GATE_REJECTED"
        }),
        corpus_write_allowed: false,
        quality_gate_required: true,
        quality_gate: "rechercher-omega-quality-gates-2026"
      };
    }
  }

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
    runtime_readiness: runtimeReadiness,
    distributed_memory: { state: distributedMemoryState, session_id: sessionId },
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
