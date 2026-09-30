/**
 * Rechercher Ω — Global Deep Research Radar.
 *
 * The radar discovers and routes research/search providers. It is deliberately
 * fail-closed: free/local paths are preferred, credit-backed APIs are bounded,
 * UI-only products are never pretended to be automatable APIs, and nothing can
 * write directly to Corpus.
 */

const DEFAULT_RADAR = new URL("../config/rechercher-omega-global-research-radar.json", import.meta.url);

export async function loadGlobalResearchRadar(url = DEFAULT_RADAR) {
  const fs = await import("node:fs/promises");
  return JSON.parse(await fs.readFile(url, "utf8"));
}

export function selectResearchProviders({
  radar,
  task,
  availableProviders = [],
  freeOnly = true,
  allowCreditProviders = true
}) {
  const allowed = new Set(availableProviders);
  const providers = radar.providers
    .filter(p => allowed.size === 0 || allowed.has(p.id))
    .filter(p => p.mode !== "ui_only")
    .filter(p => !freeOnly || p.availability === "free_no_key" || p.availability === "free_local" || (allowCreditProviders && p.availability === "free_credit"))
    .filter(p => p.paid_fallback_allowed !== true)
    .sort((a, b) => a.priority - b.priority);

  return {
    status: providers.length ? "ready" : "queued",
    task,
    providers: providers.map(p => ({
      id: p.id,
      kind: p.kind,
      mode: p.mode,
      availability: p.availability,
      requires_api_key: p.requires_api_key === true,
      endpoint: p.endpoint ?? null,
      endpoint_env: p.endpoint_env ?? null,
      priority: p.priority
    })),
    paid_fallback_allowed: false,
    corpus_write_allowed: false,
    generated_media_is_evidence: false
  };
}

export function buildResearchProbePlan({
  radar,
  task,
  availableProviders = [],
  freeOnly = true,
  allowCreditProviders = true
}) {
  const selected = selectResearchProviders({
    radar,
    task,
    availableProviders,
    freeOnly,
    allowCreditProviders
  });

  return {
    ...selected,
    probe_mode: "metadata_only",
    network_execution: false,
    credential_injection: "runtime_only",
    raw_result_persistence: false
  };
}

export function assertResearchRadarBoundary(plan) {
  if (plan.paid_fallback_allowed) {
    throw new Error("Global Deep Research Radar boundary violation: paid fallback is forbidden");
  }
  if (plan.corpus_write_allowed) {
    throw new Error("Global Deep Research Radar boundary violation: Corpus writes are forbidden");
  }
  if (plan.generated_media_is_evidence) {
    throw new Error("Global Deep Research Radar boundary violation: generated media cannot be evidence");
  }
  if (plan.network_execution) {
    throw new Error("Global Deep Research Radar health plan must not perform network execution");
  }
  return true;
}
