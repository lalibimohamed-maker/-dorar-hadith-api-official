import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  selectExecutionBackend,
  assertExecutionBoundary
} from "./rechercher-omega-execution-router.js";
import { isModelRuntimeEligible } from "./rechercher-omega-orchestrator.js";

const DEFAULT_BACKENDS = fileURLToPath(new URL("../config/rechercher-omega-execution-backends.json", import.meta.url));

function loadDefaultBackends() {
  return JSON.parse(readFileSync(DEFAULT_BACKENDS, "utf8"));
}

export function buildRuntimeGate({
  registry,
  backends = loadDefaultBackends(),
  task,
  model,
  capabilities = {},
  availableBackends = [],
  backendHealth = {},
  latencyBudgetMs = null,
  requiredCapabilities = []
}) {
  const modelEntry = registry?.models?.find(item => item.id === model);
  if (!modelEntry || !isModelRuntimeEligible(modelEntry)) {
    return {
      status: "blocked",
      task,
      model,
      reason: "model is not runtime-eligible (registry/license/status gate)",
      paid_fallback_allowed: false,
      quota_exhaustion_action: "queue",
      credential_source: "runtime_environment_only",
      output_requires_provenance: true,
      output_requires_council_for_scholarly_use: true,
      corpus_write_allowed: false
    };
  }

  const plan = selectExecutionBackend({
    backends,
    task,
    model,
    capabilities,
    availableBackends,
    backendHealth,
    preferFree: true,
    latencyBudgetMs,
    requiredCapabilities
  });
  assertExecutionBoundary(plan);
  return {
    ...plan,
    paid_fallback_allowed: false,
    quota_exhaustion_action: "queue",
    credential_source: "runtime_environment_only",
    output_requires_provenance: true,
    output_requires_council_for_scholarly_use: true,
    corpus_write_allowed: false
  };
}

export function assertRuntimeGate(gate) {
  if (gate.paid_fallback_allowed) throw new Error("paid fallback is disabled");
  if (gate.corpus_write_allowed) throw new Error("runtime gate cannot write to Corpus");
  if (gate.quota_exhaustion_action !== "queue") throw new Error("quota exhaustion must queue");
  if (gate.status === "blocked" && !gate.reason) throw new Error("blocked runtime gate requires a reason");
  return true;
}
