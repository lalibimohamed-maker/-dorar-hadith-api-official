const MAX_WORKERS = 8;
const DEFAULT_BUDGET_MS = 1800;

/**
 * Plans execution across specialized runtimes without binding the product
 * to a single language/runtime. Runtime adapters must expose capability,
 * latency, health and cancellation metadata.
 */
export function planRuntimeFederation({ task, runtimes = [], budgetMs = DEFAULT_BUDGET_MS }) {
  const eligible = runtimes
    .filter((r) => r && r.enabled !== false && r.capabilities?.includes(task))
    .filter((r) => r.healthy !== false)
    .sort((a, b) => (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity))
    .slice(0, MAX_WORKERS);

  return Object.freeze({
    task,
    budgetMs: Math.max(250, Math.min(budgetMs, DEFAULT_BUDGET_MS)),
    runtimes: eligible,
    strategy: eligible.length > 1 ? "parallel-race-with-cancellation" : "single-runtime"
  });
}

export const PERFORMANCE_LIMITS = Object.freeze({
  maxWorkers: MAX_WORKERS,
  defaultBudgetMs: DEFAULT_BUDGET_MS
});
