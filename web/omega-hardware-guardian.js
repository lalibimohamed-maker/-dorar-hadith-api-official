(() => {
  "use strict";

  const DEFAULT_WASM_CHUNK_SIZE = 128;
  let checkpointDbPromise = null;

  function dispatch(type, detail) {
    try { window.dispatchEvent(new CustomEvent(type, { detail })); } catch {}
  }

  function openCheckpointDb() {
    if (!window.indexedDB) return Promise.reject(new Error("INDEXEDDB_UNAVAILABLE"));
    if (checkpointDbPromise) return checkpointDbPromise;
    checkpointDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open("deen-allah-omega-runtime-v1", 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("audio_sessions")) db.createObjectStore("audio_sessions", { keyPath: "session_id" });
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

  async function persistAudioCheckpoint(checkpoint) {
    const sessionId = String(checkpoint?.session_id ?? "");
    if (!sessionId) throw new Error("AUDIO_SESSION_ID_MISSING");
    const record = {
      session_id: sessionId,
      byte_offset: Math.max(0, Number(checkpoint?.byte_offset) || 0),
      sequence: Math.max(0, Number(checkpoint?.sequence) || 0),
      status: String(checkpoint?.status || "PAUSED_BY_OS"),
      updated_at: new Date().toISOString()
    };
    const db = await openCheckpointDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("audio_sessions", "readwrite");
      tx.objectStore("audio_sessions").put(record);
      tx.oncomplete = () => resolve(record);
      tx.onerror = () => reject(tx.error || new Error("AUDIO_CHECKPOINT_DB_WRITE_FAILED"));
      tx.onabort = () => reject(tx.error || new Error("AUDIO_CHECKPOINT_DB_WRITE_ABORTED"));
    });
  }

  async function securePersistentStorage() {
    const storage = navigator.storage;
    const result = { supported: Boolean(storage?.persist), persisted: false, requested: false, granted: false };
    if (!storage?.persist) {
      dispatch("deenallah:omega-storage-persistence", result);
      return Object.freeze(result);
    }
    try {
      result.persisted = Boolean(await storage.persisted?.());
      if (!result.persisted) {
        result.requested = true;
        result.granted = Boolean(await storage.persist());
        result.persisted = result.granted;
      } else {
        result.granted = true;
      }
    } catch (error) {
      result.error = String(error?.message ?? error);
    }
    const frozen = Object.freeze({ ...result });
    dispatch("deenallah:omega-storage-persistence", frozen);
    return frozen;
  }

  function monitorAudioContextResilience(audioContext, {
    sessionId = "default",
    getByteOffset = () => 0,
    getSequence = () => 0,
    onInterrupt = () => {},
    onResume = () => {}
  } = {}) {
    if (!audioContext) return () => {};
    let active = true;
    const checkpoint = async status => {
      if (!active) return;
      const byteOffset = Math.max(0, Number(getByteOffset?.()) || 0);
      const sequence = Math.max(0, Number(getSequence?.()) || 0);
      try {
        await persistAudioCheckpoint({ session_id: String(sessionId), byte_offset: byteOffset, sequence, status });
      } catch {}
      dispatch("deenallah:omega-audio-checkpoint", { session_id: String(sessionId), byte_offset: byteOffset, sequence, status });
    };

    const previous = audioContext.onstatechange;
    audioContext.onstatechange = event => {
      try { previous?.call(audioContext, event); } catch {}
      const state = String(audioContext.state || "");
      if (state === "interrupted" || state === "suspended") {
        void checkpoint("PAUSED_BY_OS");
        onInterrupt({ session_id: String(sessionId), status: "PAUSED_BY_OS", byte_offset: Math.max(0, Number(getByteOffset?.()) || 0), sequence: Math.max(0, Number(getSequence?.()) || 0) });
      } else if (state === "running") {
        onResume({ session_id: String(sessionId), state });
      } else if (state === "closed") {
        void checkpoint("CLOSED_BY_OS");
        onInterrupt({ session_id: String(sessionId), status: "CLOSED_BY_OS" });
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        void checkpoint("PAGE_HIDDEN");
      } else if (document.visibilityState === "visible" && (audioContext.state === "interrupted" || audioContext.state === "suspended")) {
        Promise.resolve(audioContext.resume?.()).then(() => {
          if (audioContext.state === "running") onResume({ session_id: String(sessionId), state: "running" });
        }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (audioContext.state === "interrupted" || audioContext.state === "suspended") void checkpoint("PAUSED_BY_OS");

    return () => {
      active = false;
      audioContext.onstatechange = previous || null;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }

  function watchWebGPUDeviceLoss(gpuDevice, { fallbackToWasmCallback = () => {}, initialChunkSize = DEFAULT_WASM_CHUNK_SIZE } = {}) {
    if (!gpuDevice) return () => {};
    let active = true;
    let triggered = false;
    let chunkSize = Math.max(1, Number(initialChunkSize) || DEFAULT_WASM_CHUNK_SIZE);
    const fallback = info => {
      if (!active || triggered || String(info?.reason || "") === "destroyed") return;
      triggered = true;
      chunkSize = Math.max(1, Math.floor(chunkSize / 2));
      const detail = Object.freeze({
        backend: "wasm",
        reason: String(info?.reason || "unknown"),
        message: String(info?.message || ""),
        suggested_chunk_size: chunkSize,
        timestamp: Date.now()
      });
      dispatch("deenallah:omega-webgpu-fallback", detail);
      try { fallbackToWasmCallback(detail); } catch {}
    };
    const onUncaptured = event => {
      const error = event?.error || event;
      dispatch("deenallah:omega-webgpu-error", { message: String(error?.message || error || "WEBGPU_UNCAPTURED_ERROR"), timestamp: Date.now() });
    };
    gpuDevice.addEventListener?.("uncapturederror", onUncaptured);
    gpuDevice.lost?.then?.(fallback).catch?.(() => {});
    return () => {
      active = false;
      gpuDevice.removeEventListener?.("uncapturederror", onUncaptured);
    };
  }

  window.OmegaHardwareGuardian = Object.freeze({
    securePersistentStorage,
    persistAudioCheckpoint,
    monitorAudioContextResilience,
    watchWebGPUDeviceLoss,
    version: "1.0.0"
  });

  void securePersistentStorage().then(result => {
    dispatch("deenallah:omega-guardian-ready", result);
  }).catch(() => {
    dispatch("deenallah:omega-guardian-ready", { supported: false, persisted: false });
  });
})();
