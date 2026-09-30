const DEFAULT_WASM_CHUNK_SIZE = 128;

let checkpointDbPromise = null;

function dispatchRuntimeEvent(type, detail) {
  try {
    globalThis.dispatchEvent?.(new CustomEvent(type, { detail }));
  } catch {}
}

function openCheckpointDb(indexedDBObject = globalThis.indexedDB) {
  if (!indexedDBObject) return Promise.reject(new Error("INDEXEDDB_UNAVAILABLE"));
  if (checkpointDbPromise) return checkpointDbPromise;
  checkpointDbPromise = new Promise((resolve, reject) => {
    const request = indexedDBObject.open("deen-allah-omega-runtime-v1", 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("audio_sessions")) {
        db.createObjectStore("audio_sessions", { keyPath: "session_id" });
      }
      if (!db.objectStoreNames.contains("audio_frames")) {
        const store = db.createObjectStore("audio_frames", { keyPath: ["session_id", "sequence"] });
        store.createIndex("session_id", "session_id", { unique: false });
        store.createIndex("session_offset", ["session_id", "byte_offset"], { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("AUDIO_CHECKPOINT_DB_OPEN_FAILED"));
  });
  return checkpointDbPromise;
}

export async function persistAudioCheckpoint(checkpoint, {
  indexedDBObject = globalThis.indexedDB
} = {}) {
  const sessionId = String(checkpoint?.session_id ?? "");
  if (!sessionId) throw new Error("AUDIO_SESSION_ID_MISSING");
  const record = Object.freeze({
    session_id: sessionId,
    byte_offset: Math.max(0, Number(checkpoint?.byte_offset) || 0),
    sequence: Math.max(0, Number(checkpoint?.sequence) || 0),
    status: String(checkpoint?.status || "PAUSED_BY_OS"),
    updated_at: new Date().toISOString()
  });

  const db = await openCheckpointDb(indexedDBObject);
  return await new Promise((resolve, reject) => {
    const tx = db.transaction("audio_sessions", "readwrite");
    tx.objectStore("audio_sessions").put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error || new Error("AUDIO_CHECKPOINT_DB_WRITE_FAILED"));
    tx.onabort = () => reject(tx.error || new Error("AUDIO_CHECKPOINT_DB_WRITE_ABORTED"));
  });
}

export async function readAudioCheckpoint(sessionId, {
  indexedDBObject = globalThis.indexedDB
} = {}) {
  const db = await openCheckpointDb(indexedDBObject);
  return await new Promise((resolve, reject) => {
    const tx = db.transaction("audio_sessions", "readonly");
    const request = tx.objectStore("audio_sessions").get(String(sessionId));
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error || new Error("AUDIO_CHECKPOINT_DB_READ_FAILED"));
  });
}

export class OmegaHardwareGuardian {
  static async securePersistentStorage({
    navigatorObject = globalThis.navigator,
    storageObject = navigatorObject?.storage
  } = {}) {
    const result = { supported: Boolean(storageObject?.persist), persisted: false, requested: false, granted: false };
    if (!storageObject?.persist) {
      dispatchRuntimeEvent("deenallah:omega-storage-persistence", result);
      return Object.freeze(result);
    }

    try {
      result.persisted = Boolean(await storageObject.persisted?.());
      if (!result.persisted) {
        result.requested = true;
        result.granted = Boolean(await storageObject.persist());
        result.persisted = result.granted;
      } else {
        result.granted = true;
      }
    } catch (error) {
      result.error = String(error?.message ?? error);
    }

    dispatchRuntimeEvent("deenallah:omega-storage-persistence", Object.freeze({ ...result }));
    return Object.freeze(result);
  }

  static monitorAudioContextResilience(audioContext, {
    sessionId = "default",
    getByteOffset = () => 0,
    getSequence = () => 0,
    checkpoint = persistAudioCheckpoint,
    onInterrupt = () => {},
    onResume = () => {},
    indexedDBObject = globalThis.indexedDB,
    documentObject = globalThis.document
  } = {}) {
    if (!audioContext) return () => {};

    let active = true;
    const save = async status => {
      if (!active) return;
      const byteOffset = Math.max(0, Number(getByteOffset?.()) || 0);
      const sequence = Math.max(0, Number(getSequence?.()) || 0);
      try {
        await checkpoint({
          session_id: String(sessionId),
          byte_offset: byteOffset,
          sequence,
          status
        }, { indexedDBObject });
      } catch {}
      dispatchRuntimeEvent("deenallah:omega-audio-checkpoint", {
        session_id: String(sessionId),
        byte_offset: byteOffset,
        sequence,
        status
      });
    };

    const handleState = async () => {
      if (!active) return;
      const state = String(audioContext.state || "");
      if (state === "interrupted" || state === "suspended") {
        await save("PAUSED_BY_OS");
        onInterrupt({ session_id: String(sessionId), byte_offset: Math.max(0, Number(getByteOffset?.()) || 0), sequence: Math.max(0, Number(getSequence?.()) || 0), status: "PAUSED_BY_OS" });
        return;
      }
      if (state === "running") {
        onResume({ session_id: String(sessionId), state });
      }
      if (state === "closed") {
        await save("CLOSED_BY_OS");
        onInterrupt({ session_id: String(sessionId), status: "CLOSED_BY_OS" });
      }
    };

    const previousStateHandler = audioContext.onstatechange;
    audioContext.onstatechange = event => {
      try { previousStateHandler?.call(audioContext, event); } catch {}
      void handleState();
    };

    const onVisibilityChange = () => {
      if (documentObject?.visibilityState === "hidden") {
        void save("PAGE_HIDDEN");
        return;
      }
      if (documentObject?.visibilityState === "visible" && (audioContext.state === "interrupted" || audioContext.state === "suspended")) {
        void Promise.resolve(audioContext.resume?.()).then(() => {
          void handleState();
        }).catch(() => {});
      }
    };

    documentObject?.addEventListener?.("visibilitychange", onVisibilityChange);
    void handleState();

    return () => {
      active = false;
      if (audioContext.onstatechange === previousStateHandler || audioContext.onstatechange) {
        audioContext.onstatechange = previousStateHandler || null;
      }
      documentObject?.removeEventListener?.("visibilitychange", onVisibilityChange);
    };
  }

  static watchWebGPUDeviceLoss(gpuDevice, {
    fallbackToWasmCallback = () => {},
    initialChunkSize = DEFAULT_WASM_CHUNK_SIZE
  } = {}) {
    if (!gpuDevice) return () => {};

    let active = true;
    let triggered = false;
    let chunkSize = Math.max(1, Number(initialChunkSize) || DEFAULT_WASM_CHUNK_SIZE);

    const triggerFallback = info => {
      if (!active || triggered) return;
      triggered = true;
      chunkSize = Math.max(1, Math.floor(chunkSize / 2));
      const detail = Object.freeze({
        backend: "wasm",
        reason: String(info?.reason || "unknown"),
        message: String(info?.message || ""),
        suggested_chunk_size: chunkSize,
        timestamp: Date.now()
      });
      dispatchRuntimeEvent("deenallah:omega-webgpu-fallback", detail);
      try { fallbackToWasmCallback(detail); } catch {}
    };

    const uncapturedHandler = event => {
      const error = event?.error || event;
      dispatchRuntimeEvent("deenallah:omega-webgpu-error", {
        message: String(error?.message || error || "WEBGPU_UNCAPTURED_ERROR"),
        timestamp: Date.now()
      });
    };

    gpuDevice.addEventListener?.("uncapturederror", uncapturedHandler);
    if (gpuDevice.lost && typeof gpuDevice.lost.then === "function") {
      gpuDevice.lost.then(info => triggerFallback(info)).catch(() => {});
    }

    return () => {
      active = false;
      gpuDevice.removeEventListener?.("uncapturederror", uncapturedHandler);
    };
  }
}

export const OMEGA_HARDWARE_GUARDIAN_VERSION = "1.0.0";
