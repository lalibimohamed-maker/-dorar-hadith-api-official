import { selectExecutionBackend, assertExecutionBoundary } from "./rechercher-omega-execution-router.js";

export function buildRuntimeGate({ registry, backends, task, model, capabilities = {}, availableBackends = [] }) {
  const plan = selectExecutionBackend({
    backends, task, model, capabilities,
    availableBackends, preferFree: true
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
  return true;
}
