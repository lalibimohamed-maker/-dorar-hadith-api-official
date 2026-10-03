const FINAL = new Set(["completed","failed","cancelled"]);

export function createVoiceJobLedger({ storage = new Map(), onEvent = () => {} } = {}) {
  if (!storage || typeof storage.get !== "function" || typeof storage.set !== "function") {
    throw new TypeError("storage must expose get/set");
  }

  function key(idempotencyKey) {
    if (!idempotencyKey) throw new TypeError("idempotencyKey is required");
    return `voice-job-ledger:${idempotencyKey}`;
  }

  function begin({ idempotencyKey, jobType, manifestHash = null } = {}) {
    if (!jobType) throw new TypeError("jobType is required");
    const k = key(idempotencyKey);
    const existing = storage.get(k);
    if (existing) {
      if (manifestHash && existing.manifestHash && manifestHash !== existing.manifestHash) {
        throw new Error("idempotency key reused with a different manifest");
      }
      return Object.freeze({ ...existing, reused: true });
    }
    const job = Object.freeze({
      idempotencyKey: String(idempotencyKey),
      jobType: String(jobType),
      manifestHash: manifestHash == null ? null : String(manifestHash),
      state: "running",
      createdAt: new Date().toISOString(),
    });
    storage.set(k, job);
    onEvent({ type: "job.started", job: job.idempotencyKey, jobType: job.jobType });
    return job;
  }

  function finish({ idempotencyKey, state = "completed", outputRef = null } = {}) {
    if (!FINAL.has(state)) throw new Error("invalid terminal job state");
    const k = key(idempotencyKey);
    const job = storage.get(k);
    if (!job) throw new Error("unknown job");
    if (FINAL.has(job.state) && job.state !== state) throw new Error("job already terminated");
    const next = Object.freeze({
      ...job,
      state,
      outputRef: outputRef == null ? null : String(outputRef),
      completedAt: new Date().toISOString(),
    });
    storage.set(k, next);
    onEvent({ type: `job.${state}`, job: next.idempotencyKey, outputRef: next.outputRef });
    return next;
  }

  function cancel(idempotencyKey) {
    return finish({ idempotencyKey, state: "cancelled" });
  }

  function get(idempotencyKey) {
    return storage.get(key(idempotencyKey)) || null;
  }

  return Object.freeze({ begin, finish, cancel, get });
}
