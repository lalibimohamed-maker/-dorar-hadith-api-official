const DB_NAME = "deen-allah-omega-runtime-v1";
const DB_VERSION = 2;
const STORE_NAME = "audio_frames";

function openAudioDb(indexedDBObject = globalThis.indexedDB) {
  if (!indexedDBObject) return Promise.reject(new Error("INDEXEDDB_UNAVAILABLE"));
  return new Promise((resolve, reject) => {
    const request = indexedDBObject.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: ["session_id", "sequence"] });
        store.createIndex("session_id", "session_id", { unique: false });
        store.createIndex("session_offset", ["session_id", "byte_offset"], { unique: false });
      }
      if (!db.objectStoreNames.contains("audio_sessions")) {
        db.createObjectStore("audio_sessions", { keyPath: "session_id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("AUDIO_DB_OPEN_FAILED"));
  });
}

function toUint8Array(bytes) {
  if (bytes instanceof Uint8Array) return bytes;
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
  if (ArrayBuffer.isView(bytes)) return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  throw new TypeError("audio frame must be ArrayBuffer or Uint8Array");
}

async function txRequest(db, mode, action) {
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    let result;
    let request;
    try { request = action(store); } catch (error) { reject(error); return; }
    if (request) {
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error || new Error("AUDIO_FRAME_REQUEST_FAILED"));
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error("AUDIO_FRAME_TX_FAILED"));
    tx.onabort = () => reject(tx.error || new Error("AUDIO_FRAME_TX_ABORTED"));
  });
}

export class OmegaResilientAudioSession {
  constructor({
    sessionId,
    indexedDBObject = globalThis.indexedDB,
    feedFrame = async () => {},
    initialByteOffset = 0
  } = {}) {
    if (!sessionId) throw new TypeError("sessionId is required");
    this.sessionId = String(sessionId);
    this.indexedDBObject = indexedDBObject;
    this.feedFrame = feedFrame;
    this.nextSequence = 0;
    this.byteOffset = Math.max(0, Number(initialByteOffset) || 0);
    this.paused = false;
  }

  async persistFrame(bytes) {
    const frame = toUint8Array(bytes);
    if (!frame.byteLength) return Object.freeze({
      session_id: this.sessionId,
      sequence: this.nextSequence,
      byte_offset: this.byteOffset,
      bytes: 0,
      status: "EMPTY"
    });

    const sequence = this.nextSequence++;
    const offset = this.byteOffset;
    this.byteOffset += frame.byteLength;

    const db = await openAudioDb(this.indexedDBObject);
    await txRequest(db, "readwrite", store => store.put({
      session_id: this.sessionId,
      sequence,
      byte_offset: offset,
      bytes: frame.byteLength,
      data: frame.slice().buffer
    }));

    return Object.freeze({
      session_id: this.sessionId,
      sequence,
      byte_offset: offset,
      bytes: frame.byteLength,
      status: "PERSISTED"
    });
  }

  async ingestFrame(bytes) {
    const metadata = await this.persistFrame(bytes);
    if (metadata.bytes === 0 || this.paused) return metadata;

    try {
      await this.feedFrame(bytes, metadata);
      await this.acknowledge(metadata.sequence);
      return Object.freeze({ ...metadata, status: "FED_AND_ACKED" });
    } catch (error) {
      return Object.freeze({
        ...metadata,
        status: "QUEUED_AFTER_FEED_FAILURE",
        error: String(error?.message ?? error)
      });
    }
  }

  async acknowledge(sequence) {
    const db = await openAudioDb(this.indexedDBObject);
    await txRequest(db, "readwrite", store => store.delete([this.sessionId, Number(sequence)]));
  }

  async pendingFrames() {
    const db = await openAudioDb(this.indexedDBObject);
    const all = await txRequest(db, "readonly", store => store.getAll());
    return all
      .filter(item => item?.session_id === this.sessionId)
      .sort((a, b) => Number(a.sequence) - Number(b.sequence));
  }

  async resumePending() {
    if (this.paused) this.paused = false;
    const pending = await this.pendingFrames();
    for (const frame of pending) {
      await this.feedFrame(new Uint8Array(frame.data), {
        session_id: this.sessionId,
        sequence: frame.sequence,
        byte_offset: frame.byte_offset,
        bytes: frame.bytes,
        replay: true
      });
      await this.acknowledge(frame.sequence);
    }
    return pending.length;
  }

  pause() {
    this.paused = true;
    return Object.freeze({
      session_id: this.sessionId,
      byte_offset: this.byteOffset,
      sequence: this.nextSequence,
      status: "PAUSED_BY_OS"
    });
  }

  async restoreCheckpoint(checkpoint) {
    if (!checkpoint || String(checkpoint.session_id || "") !== this.sessionId) {
      throw new Error("AUDIO_CHECKPOINT_SESSION_MISMATCH");
    }
    this.nextSequence = Math.max(0, Number(checkpoint.sequence) || 0);
    this.byteOffset = Math.max(0, Number(checkpoint.byte_offset) || 0);
    this.paused = String(checkpoint.status || "") !== "RUNNING";
    return this.getCheckpoint();
  }

  async resume() {
    const replayed = await this.resumePending();
    return Object.freeze({ replayed, checkpoint: this.getCheckpoint() });
  }

  getCheckpoint()
    return Object.freeze({
      session_id: this.sessionId,
      byte_offset: this.byteOffset,
      sequence: this.nextSequence,
      status: this.paused ? "PAUSED_BY_OS" : "RUNNING"
    });
  }
}

export const OMEGA_AUDIO_SESSION_VERSION = "1.0.0";
