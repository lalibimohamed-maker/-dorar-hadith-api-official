import { createHash } from "node:crypto";

export const JOB_STATES = Object.freeze([
  "queued",
  "running",
  "succeeded",
  "failed",
  "retryable",
  "cancelled",
  "dead_letter"
]);

const TERMINAL = new Set(["succeeded","cancelled","dead_letter"]);
const TRANSITIONS = Object.freeze({
  queued: new Set(["running","cancelled"]),
  running: new Set(["succeeded","failed","retryable","cancelled"]),
  retryable: new Set(["queued","running","cancelled","dead_letter"]),
  failed: new Set(["queued","dead_letter"]),
  succeeded: new Set([]),
  cancelled: new Set([]),
  dead_letter: new Set([])
});

function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + stable(value[k])).join(",") + "}";
}

export function deterministicJobId({ kind, payload = {}, revision = "1" } = {}) {
  if (!kind) throw new TypeError("job kind is required");
  const canonical = stable({ kind, payload, revision });
  return "job-" + createHash("sha256").update(canonical, "utf8").digest("hex").slice(0, 32);
}

export function createJob({ kind, payload = {}, revision = "1", maxAttempts = 3, metadata = {} } = {}) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
    throw new RangeError("maxAttempts must be an integer between 1 and 20");
  }
  const jobId = deterministicJobId({ kind, payload, revision });
  return {
    schema_version: "1.0.0",
    job_id: jobId,
    idempotency_key: jobId,
    kind,
    revision,
    state: "queued",
    attempts: 0,
    max_attempts: maxAttempts,
    payload,
    metadata,
    policy: {
      corpus_write_allowed: false,
      generated_media_is_evidence: false,
      idempotent: true,
      fail_closed: true
    }
  };
}

export function transitionJob(job, nextState, { error = null, retryAfterMs = null } = {}) {
  if (!job || !JOB_STATES.includes(job.state)) throw new TypeError("invalid job state");
  if (!JOB_STATES.includes(nextState)) throw new TypeError("invalid next job state");
  if (!TRANSITIONS[job.state].has(nextState)) {
    throw new Error(`invalid job transition: ${job.state} -> ${nextState}`);
  }
  const next = structuredClone(job);
  if (nextState === "running") {
    next.attempts += 1;
    if (next.attempts > next.max_attempts) {
      next.state = "dead_letter";
      next.error = { type: "max_attempts_exceeded", message: "maximum job attempts exceeded" };
      return next;
    }
  }
  next.state = nextState;
  if (error) next.error = { type: error.type ?? "execution_error", message: String(error.message ?? error) };
  if (retryAfterMs != null) next.retry_after_ms = Math.max(0, Number(retryAfterMs) || 0);
  if (TERMINAL.has(nextState)) next.completed_at = new Date().toISOString();
  return next;
}

export function assertJobBoundary(job) {
  if (job?.policy?.corpus_write_allowed === true) throw new Error("job cannot write Corpus");
  if (job?.policy?.generated_media_is_evidence === true) throw new Error("generated media cannot be evidence");
  if (job?.policy?.idempotent !== true) throw new Error("job must be idempotent");
  return true;
}
