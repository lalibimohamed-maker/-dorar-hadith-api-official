export function createLongFormCheckpointStore({ storage = new Map() } = {}) {
  if (!storage || typeof storage.get !== "function" || typeof storage.set !== "function") {
    throw new TypeError("storage must expose get/set");
  }

  function key(jobId) {
    if (!jobId) throw new TypeError("jobId is required");
    return `voice-job:${jobId}`;
  }

  function save({
    jobId,
    manifestHash,
    chunkIndex,
    totalChunks,
    status = "completed",
    outputRef = null,
  } = {}) {
    if (!manifestHash) throw new TypeError("manifestHash is required");
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) throw new TypeError("chunkIndex must be a non-negative integer");
    if (!Number.isInteger(totalChunks) || totalChunks < 1 || chunkIndex >= totalChunks) {
      throw new TypeError("totalChunks/chunkIndex are invalid");
    }
    if (status !== "completed" && status !== "failed" && status !== "in-progress") {
      throw new TypeError("invalid checkpoint status");
    }
    const previous = storage.get(key(jobId));
    if (previous && manifestHash !== previous.manifestHash) {
      throw new Error("checkpoint manifest mismatch");
    }
    if (previous && chunkIndex < previous.chunkIndex) {
      throw new Error("checkpoint regression is not allowed");
    }
    const checkpoint = Object.freeze({
      jobId: String(jobId),
      manifestHash: String(manifestHash),
      chunkIndex,
      totalChunks,
      status,
      outputRef: outputRef == null ? null : String(outputRef),
      updatedAt: new Date().toISOString(),
    });
    storage.set(key(jobId), checkpoint);
    return checkpoint;
  }

  function resume(jobId, manifestHash) {
    const checkpoint = storage.get(key(jobId)) || null;
    if (!checkpoint) return null;
    if (checkpoint.manifestHash !== manifestHash) {
      throw new Error("checkpoint manifest mismatch");
    }
    return Object.freeze({
      ...checkpoint,
      nextChunkIndex: checkpoint.chunkIndex + 1,
      resumable: checkpoint.chunkIndex + 1 < checkpoint.totalChunks,
    });
  }

  return Object.freeze({ save, resume });
}
