import test from "node:test";
import assert from "node:assert/strict";
import { OmegaResilientAudioSession } from "../packages/omega-browser/src/omega-audio-session.js";

class FakeRequest {
  constructor(result = undefined) {
    this.result = result;
    this.onsuccess = null;
    this.onerror = null;
  }
}

test("audio session persists monotonically numbered frames before feeding", async () => {
  const frames = [];
  const fed = [];
  const fakeStore = {
    put(record) { frames.push(record); return new FakeRequest(record); },
    delete() { return new FakeRequest(); },
    getAll() { return new FakeRequest(frames.slice()); }
  };
  const fakeDb = {
    transaction() {
      const tx = { objectStore: () => fakeStore, oncomplete: null, onerror: null, onabort: null };
      queueMicrotask(() => tx.oncomplete?.());
      return tx;
    }
  };
  const indexedDB = {
    open() {
      const request = new FakeRequest(fakeDb);
      queueMicrotask(() => { request.onsuccess?.(); });
      return request;
    }
  };

  const session = new OmegaResilientAudioSession({
    sessionId: "audio-1",
    indexedDBObject: indexedDB,
    feedFrame: async (bytes, meta) => {
      fed.push({ byteLength: bytes.byteLength, ...meta });
    }
  });

  const first = await session.ingestFrame(new Uint8Array([1, 2, 3]));
  const second = await session.ingestFrame(new Uint8Array([4, 5]));
  assert.equal(first.byte_offset, 0);
  assert.equal(second.byte_offset, 3);
  assert.equal(frames.length, 2);
  assert.equal(fed.length, 2);
  assert.equal(session.getCheckpoint().byte_offset, 5);
});

test("audio session pauses without changing the committed byte offset", async () => {
  const indexedDB = {
    open() {
      const store = {
        put: r => ({ result: r }),
        delete: () => ({}),
        getAll: () => ({ result: [] })
      };
      const tx = { objectStore: () => store };
      const req = {
        onsuccess: null, onerror: null, onupgradeneeded: null, result: {
          objectStoreNames: { contains: () => true },
          transaction: () => tx
        }
      };
      queueMicrotask(() => req.onsuccess?.());
      return req;
    }
  };
  const session = new OmegaResilientAudioSession({ sessionId: "audio-2", indexedDBObject: indexedDB });
  session.byteOffset = 8192;
  const checkpoint = session.pause();
  assert.equal(checkpoint.byte_offset, 8192);
  assert.equal(checkpoint.status, "PAUSED_BY_OS");
});
