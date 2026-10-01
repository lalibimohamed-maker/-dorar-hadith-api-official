(() => {
  "use strict";

  const DB_NAME = "deen-allah-omega-local-v1";
  const DB_VERSION = 2;
  const STORE_NAME = "evidence";
  const META_STORE = "sync_state";
  const FORMAT = "dinullah/omega-offline-evidence-delta";
  const SCHEMA_VERSION = "1.0.0";
  const HEX_SHA256 = /^[a-f0-9]{64}$/i;
  const SIGNATURE_LENGTH = 64;
  let dbPromise = null;

  function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.keys(value)
          .filter(key => value[key] !== undefined)
          .sort()
          .map(key => [key, canonicalize(value[key])])
      );
    }
    return value;
  }

  function utf8(value) {
    return new TextEncoder().encode(String(value));
  }

  function hexFromBytes(bytes) {
    return [...new Uint8Array(bytes)]
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function base64ToBytes(value) {
    const binary = atob(String(value || ""));
    const output = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) output[i] = binary.charCodeAt(i);
    return output;
  }

  async function sha256Text(value) {
    return hexFromBytes(await crypto.subtle.digest("SHA-256", utf8(value)));
  }

  function normalizedRecord(record) {
    return {
      node_id: String(record?.node_id ?? ""),
      content_sha256: String(record?.content_sha256 ?? "").toLowerCase(),
      verification_status: "verified",
      title: String(record?.title ?? ""),
      text: String(record?.text ?? ""),
      citation: String(record?.citation ?? ""),
      source_id: String(record?.source_id ?? record?.sourceId ?? ""),
      language: String(record?.language ?? ""),
      updated_at: String(record?.updated_at ?? "")
    };
  }

  async function merkleRoot(records) {
    let level = [];
    const sorted = [...records].sort((a, b) =>
      String(a?.node_id ?? "").localeCompare(String(b?.node_id ?? ""))
    );

    for (const record of sorted) {
      const canonical = JSON.stringify(canonicalize({
        node_id: String(record?.node_id ?? ""),
        content_sha256: String(record?.content_sha256 ?? "").toLowerCase(),
        verification_status: String(record?.verification_status ?? ""),
        title: String(record?.title ?? ""),
        text: String(record?.text ?? ""),
        citation: String(record?.citation ?? ""),
        source_id: String(record?.source_id ?? record?.sourceId ?? ""),
        language: String(record?.language ?? ""),
        updated_at: String(record?.updated_at ?? "")
      }));
      level.push(await sha256Text(
        "dinullah:omega:evidence:snapshot-leaf:v2\u0000" + canonical
      ));
    }

    if (!level.length) {
      return sha256Text("dinullah:omega:evidence:snapshot-empty:v2\u0000");
    }

    while (level.length > 1) {
      const next = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] || left;
        next.push(await sha256Text(
          "dinullah:omega:evidence:snapshot-parent:v2\u0000" + left + "\u0000" + right
        ));
      }
      level = next;
    }

    return level[0];
  }

  function deltaPayload(delta) {
    const operations = [...(delta.operations || [])]
      .map(op => {
        if (op.op === "upsert") {
          return {
            op: "upsert",
            node_id: String(op.record?.node_id ?? ""),
            previous_content_sha256: op.previous_content_sha256 == null
              ? null
              : String(op.previous_content_sha256).toLowerCase(),
            record: normalizedRecord(op.record)
          };
        }
        if (op.op !== "delete") {
          throw new Error("OFFLINE_DELTA_OPERATION_UNSUPPORTED");
        }
        return {
          op: "delete",
          node_id: String(op.node_id ?? ""),
          previous_content_sha256: op.previous_content_sha256 == null
            ? null
            : String(op.previous_content_sha256).toLowerCase()
        };
      })
      .sort((a, b) =>
        a.node_id.localeCompare(b.node_id) || a.op.localeCompare(b.op)
      );

    return {
      schema_version: SCHEMA_VERSION,
      format: FORMAT,
      snapshot_algorithm: "omega-evidence-snapshot-v2",
      sequence: Math.max(1, Number(delta.sequence) || 0),
      generated_at: String(delta.generated_at || ""),
      base_snapshot_sha256: String(delta.base_snapshot_sha256 || "").toLowerCase(),
      target_snapshot_sha256: String(delta.target_snapshot_sha256 || "").toLowerCase(),
      operations
    };
  }

  function signedEnvelope(delta) {
    return {
      ...deltaPayload(delta),
      delta_sha256: String(delta.delta_sha256 || "").toLowerCase(),
      signature: {
        algorithm: String(delta.signature?.algorithm || ""),
        public_key_id: String(delta.signature?.public_key_id || "")
      }
    };
  }

  async function verifyDeltaEnvelope(delta, trustedPublicKeys = {}) {
    if (!delta || typeof delta !== "object") throw new Error("OFFLINE_DELTA_INVALID");
    if (delta.schema_version !== SCHEMA_VERSION ||
        delta.format !== FORMAT ||
        delta.snapshot_algorithm !== "omega-evidence-snapshot-v2") {
      throw new Error("OFFLINE_DELTA_SCHEMA_UNSUPPORTED");
    }

    const payload = deltaPayload(delta);
    if (!HEX_SHA256.test(payload.base_snapshot_sha256)) {
      throw new Error("OFFLINE_DELTA_BASE_ROOT_INVALID");
    }
    if (!HEX_SHA256.test(payload.target_snapshot_sha256)) {
      throw new Error("OFFLINE_DELTA_TARGET_ROOT_INVALID");
    }

    const claimedDeltaSha = String(delta.delta_sha256 || "").toLowerCase();
    if (!HEX_SHA256.test(claimedDeltaSha)) throw new Error("OFFLINE_DELTA_HASH_MISSING");

    const actualDeltaSha = await sha256Text(JSON.stringify(canonicalize(payload)) + "\n");
    if (actualDeltaSha !== claimedDeltaSha) throw new Error("OFFLINE_DELTA_HASH_MISMATCH");

    const metadata = delta.signature;
    if (metadata?.algorithm !== "ed25519") throw new Error("OFFLINE_DELTA_SIGNATURE_ALGORITHM_UNSUPPORTED");

    const keyId = String(metadata.public_key_id || "");
    const trustedKey = trustedPublicKeys?.[keyId];
    if (!keyId || typeof trustedKey !== "string") {
      throw new Error("OFFLINE_DELTA_TRUSTED_PUBLIC_KEY_MISSING");
    }

    let publicKeyBytes;
    let signatureBytes;
    try {
      publicKeyBytes = base64ToBytes(trustedKey);
      signatureBytes = base64ToBytes(metadata.signature_base64);
    } catch {
      throw new Error("OFFLINE_DELTA_SIGNATURE_BASE64_INVALID");
    }

    if (publicKeyBytes.byteLength !== 32 || signatureBytes.byteLength !== SIGNATURE_LENGTH) {
      throw new Error("OFFLINE_DELTA_SIGNATURE_LENGTH_INVALID");
    }

    let key;
    try {
      key = await crypto.subtle.importKey(
        "raw",
        publicKeyBytes,
        { name: "Ed25519" },
        false,
        ["verify"]
      );
    } catch {
      throw new Error("OFFLINE_DELTA_ED25519_UNSUPPORTED");
    }

    const signedBytes = utf8(JSON.stringify(canonicalize(signedEnvelope(delta))) + "\n");
    const valid = await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      signatureBytes,
      signedBytes
    );

    if (!valid) throw new Error("OFFLINE_DELTA_SIGNATURE_INVALID");
    return Object.freeze({ verified: true, delta_sha256: claimedDeltaSha, public_key_id: keyId });
  }

  function openDb() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "node_id" });
          store.createIndex("source_id", "source_id", { unique: false });
          store.createIndex("verification_status", "verification_status", { unique: false });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("OFFLINE_DELTA_DB_OPEN_FAILED"));
    });

    return dbPromise;
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("OFFLINE_DELTA_REQUEST_FAILED"));
    });
  }

  async function readState() {
    const db = await openDb();
    const [records, state] = await Promise.all([
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error || new Error("OFFLINE_DELTA_EVIDENCE_READ_FAILED"));
      }),
      new Promise((resolve, reject) => {
        const tx = db.transaction(META_STORE, "readonly");
        const req = tx.objectStore(META_STORE).get("evidence");
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error || new Error("OFFLINE_DELTA_STATE_READ_FAILED"));
      })
    ]);

    const verifiedRecords = records.filter(record =>
      record?.verification_status === "verified" &&
      HEX_SHA256.test(String(record?.content_sha256 || ""))
    );

    const computedRoot = await merkleRoot(verifiedRecords);
    return Object.freeze({
      records: verifiedRecords,
      state,
      computed_root_sha256: computedRoot
    });
  }

  function validateOperation(op, recordsById) {
    if (!["upsert", "delete"].includes(op?.op)) {
      throw new Error("OFFLINE_DELTA_OPERATION_UNSUPPORTED");
    }

    const nodeId = String(op.op === "upsert" ? op.record?.node_id : op.node_id);
    if (!nodeId) throw new Error("OFFLINE_DELTA_NODE_ID_MISSING");

    const expected = op.previous_content_sha256 == null
      ? null
      : String(op.previous_content_sha256).toLowerCase();

    if (expected !== null && !HEX_SHA256.test(expected)) {
      throw new Error("OFFLINE_DELTA_PREVIOUS_HASH_INVALID");
    }

    const current = recordsById.get(nodeId) || null;

    if (expected === null && current) {
      throw new Error("OFFLINE_DELTA_PRECONDITION_FAILED");
    }

    if (expected !== null && (!current || String(current.content_sha256).toLowerCase() !== expected)) {
      throw new Error("OFFLINE_DELTA_PRECONDITION_FAILED");
    }

    if (op.op === "upsert") {
      const record = normalizedRecord(op.record);
      if (!record.node_id || !record.text) throw new Error("OFFLINE_DELTA_RECORD_INVALID");
      if (!HEX_SHA256.test(record.content_sha256)) throw new Error("OFFLINE_DELTA_CONTENT_HASH_INVALID");
      if (record.verification_status !== "verified") throw new Error("OFFLINE_DELTA_RECORD_UNVERIFIED");
    }

    return nodeId;
  }

  async function applyDelta(delta, {
    trustedPublicKeys = {},
    requireSignature = true
  } = {}) {
    if (requireSignature) await verifyDeltaEnvelope(delta, trustedPublicKeys);

    const payload = deltaPayload(delta);
    const operations = payload.operations;

    const seen = new Set();
    for (const op of operations) {
      if (seen.has(op.node_id)) throw new Error("OFFLINE_DELTA_DUPLICATE_NODE");
      seen.add(op.node_id);
    }

    for (const op of operations) {
      if (op.op === "upsert") {
        const actual = await sha256Text(op.record.text);
        if (actual !== op.record.content_sha256) {
          throw new Error("OFFLINE_DELTA_CONTENT_HASH_MISMATCH");
        }
      }
    }

    const snapshot = await readState();
    if (snapshot.state?.dirty === true) {
      throw new Error("OFFLINE_DELTA_LOCAL_STATE_DIRTY");
    }

    const stateRoot = snapshot.state?.dirty === false &&
      snapshot.state?.snapshot_algorithm === "omega-evidence-snapshot-v2" &&
      HEX_SHA256.test(String(snapshot.state?.snapshot_sha256 || ""))
      ? String(snapshot.state.snapshot_sha256).toLowerCase()
      : snapshot.computed_root_sha256;

    if (snapshot.state?.snapshot_algorithm === "omega-evidence-snapshot-v2" &&
        snapshot.state?.dirty === false &&
        HEX_SHA256.test(String(snapshot.state.snapshot_sha256 || "")) &&
        String(snapshot.state.snapshot_sha256).toLowerCase() !== snapshot.computed_root_sha256) {
      throw new Error("OFFLINE_DELTA_LOCAL_SNAPSHOT_CORRUPT");
    }

    if (stateRoot !== payload.base_snapshot_sha256) {
      throw new Error("OFFLINE_DELTA_BASE_SNAPSHOT_MISMATCH");
    }

    const nextById = new Map(snapshot.records.map(record => [record.node_id, record]));

    for (const op of operations) {
      validateOperation(op, nextById);
      if (op.op === "delete") {
        nextById.delete(op.node_id);
      } else {
        nextById.set(op.node_id, normalizedRecord(op.record));
      }
    }

    const nextRecords = [...nextById.values()].sort((a, b) =>
      a.node_id.localeCompare(b.node_id)
    );
    const computedTargetRoot = (await merkleRoot(nextRecords)).toLowerCase();
    if (computedTargetRoot !== payload.target_snapshot_sha256) {
      throw new Error("OFFLINE_DELTA_TARGET_SNAPSHOT_MISMATCH");
    }

    const db = await openDb();

    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME, META_STORE], "readwrite");
      const evidenceStore = tx.objectStore(STORE_NAME);
      const metaStore = tx.objectStore(META_STORE);

      const stateRequest = metaStore.get("evidence");
      stateRequest.onsuccess = () => {
        const currentState = stateRequest.result;
        const currentRoot = currentState?.dirty === false &&
          currentState?.snapshot_algorithm === "omega-evidence-snapshot-v2" &&
          HEX_SHA256.test(String(currentState?.snapshot_sha256 || ""))
          ? String(currentState.snapshot_sha256).toLowerCase()
          : null;

        if (currentRoot !== payload.base_snapshot_sha256 ||
            Number(currentState?.sequence || 0) >= payload.sequence) {
          tx.abort();
          return;
        }

        for (const op of operations) {
          if (op.op === "delete") evidenceStore.delete(op.node_id);
          else evidenceStore.put(normalizedRecord(op.record));
        }

        metaStore.put({
          id: "evidence",
          snapshot_sha256: payload.target_snapshot_sha256,
          dirty: false,
          sequence: payload.sequence,
          updated_at: new Date().toISOString()
        });
      };

      stateRequest.onerror = () => tx.abort();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("OFFLINE_DELTA_TRANSACTION_FAILED"));
      tx.onabort = () => reject(tx.error || new Error("OFFLINE_DELTA_TRANSACTION_ABORTED"));
    });

    globalThis.dispatchEvent?.(new CustomEvent("deenallah:omega-delta-applied", {
      detail: {
        sequence: payload.sequence,
        base_snapshot_sha256: payload.base_snapshot_sha256,
        target_snapshot_sha256: payload.target_snapshot_sha256
      }
    }));

    return Object.freeze({
      applied: true,
      sequence: payload.sequence,
      operations: operations.length,
      base_snapshot_sha256: payload.base_snapshot_sha256,
      target_snapshot_sha256: payload.target_snapshot_sha256
    });
  }

  async function fetchAndApply(url, options = {}) {
    const mode = options.mode || "auto";
    if (mode === "offline_only") {
      throw new Error("OFFLINE_DELTA_NETWORK_BLOCKED");
    }

    const parsedUrl = new URL(String(url), globalThis.location?.href || "http://localhost/");
    if (parsedUrl.protocol !== "https:" &&
        parsedUrl.protocol !== "http:") {
      throw new Error("OFFLINE_DELTA_URL_PROTOCOL_REJECTED");
    }
    if (globalThis.location?.origin &&
        parsedUrl.origin !== globalThis.location.origin) {
      throw new Error("OFFLINE_DELTA_CROSS_ORIGIN_REJECTED");
    }

    const response = await fetch(parsedUrl.href, {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) throw new Error("OFFLINE_DELTA_HTTP_" + response.status);

    const delta = await response.json();
    return applyDelta(delta, options);
  }

  globalThis.deenAllahOmegaOfflineSync = Object.freeze({
    applyDelta,
    fetchAndApply,
    verifyDeltaEnvelope,
    computeSnapshotRoot: async () => (await readState()).computed_root_sha256,
    getState: async () => {
      const snapshot = await readState();
      return Object.freeze({
        ...snapshot.state,
        snapshot_sha256: snapshot.computed_root_sha256
      });
    },
    format: FORMAT,
    schema_version: SCHEMA_VERSION
  });
})();
