/**
 * Rechercher Ω — resource admission control.
 * Pure policy: the runtime supplies live job/VRAM observations.
 */
export function admitExecution({
  pool,
  currentJobs = 0,
  currentVramMb = 0,
  requiredVramMb = 0
} = {}) {
  if (!pool || typeof pool !== "object") throw new TypeError("resource pool is required");
  if (!Number.isInteger(currentJobs) || currentJobs < 0) throw new RangeError("currentJobs must be >= 0");
  if (!Number.isFinite(currentVramMb) || currentVramMb < 0) throw new RangeError("currentVramMb must be >= 0");
  if (!Number.isFinite(requiredVramMb) || requiredVramMb < 0) throw new RangeError("requiredVramMb must be >= 0");

  const maxConcurrency = Number(pool.max_concurrency ?? 1);
  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1) throw new RangeError("pool.max_concurrency must be a positive integer");

  if (currentJobs >= maxConcurrency) {
    return { status: "queued", reason: "concurrency_limit", available_slots: 0 };
  }

  const budget = pool.vram_budget_mb == null ? null : Number(pool.vram_budget_mb);
  if (budget != null && (!Number.isFinite(budget) || budget < 0)) {
    throw new RangeError("pool.vram_budget_mb must be null or a non-negative number");
  }

  if (budget != null && currentVramMb + requiredVramMb > budget) {
    return {
      status: "queued",
      reason: "vram_budget",
      vram_budget_mb: budget,
      vram_available_mb: Math.max(0, budget - currentVramMb),
      required_vram_mb: requiredVramMb
    };
  }

  return {
    status: "admitted",
    available_slots: maxConcurrency - currentJobs,
    vram_budget_mb: budget,
    vram_available_mb: budget == null ? null : Math.max(0, budget - currentVramMb)
  };
}

export function assertAdmitted(result) {
  if (result?.status !== "admitted") throw new Error("resource admission did not pass");
  return true;
}
