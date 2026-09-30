(() => {
  const DB_NAME = "deen-allah-omega-local-v1";
  const DB_VERSION = 2;
  const STORE_NAME = "evidence";
  const META_STORE = "sync_state";
  const HEX_SHA256 = /^[a-f0-9]{64}$/i;
  const TASHKEEL = /[\u064B-\u065F\u0670]/gu;
  const TATWEEL = /\u0640+/gu;

  let dbPromise = null;

  function normalizeQuery(value) {
    let text = String(value ?? "").normalize("NFKC").normalize("NFC");
    text = text.replace(TATWEEL, "").replace(TASHKEEL, "");
    for (const [from, to] of [["آ","ا"],["أ","ا"],["إ","ا"],["ٱ","ا"],["ؤ","و"],["ئ","ي"]]) {
      text = text.split(from).join(to);
    }
    return text.replace(/\s+/gu, " ").trim();
  }

  function variants(value) {
    const raw = String(value ?? "").normalize("NFC").trim();
    const normalized = normalizeQuery(raw);
    const maqsurah = normalized.replace(/ى/g, "ي");
    const loose = maqsurah.replace(/ة/g, "ه");
    return [...new Set([raw, normalized, maqsurah, loose].filter(Boolean))];
  }

  async function sha256Text(value) {
    const bytes = new TextEncoder().encode(String(value));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async function merkleRoot(records) {
    let level = [];
    for (const record of records) {
      const leafMaterial = "dinullah:omega:evidence:leaf:v1\\u0000" + String(record?.node_id ?? "") + "\\u0000" + String(record?.content_sha256 ?? "").toLowerCase();
      level.push(await sha256Text(leafMaterial));
    }
    if (!level.length) return sha256Text("dinullah:omega:evidence:empty:v1\\u0000");
    while (level.length > 1) {
      const next = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] || left;
        next.push(await sha256Text("dinullah:omega:evidence:parent:v1\\u0000" + left + "\\u0000" + right));
      }
      level = next;
    }
    return level[0];
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = database.createObjectStore(STORE_NAME, { keyPath: "node_id" });
          objectStore.createIndex("source_id", "source_id", { unique: false });
          objectStore.createIndex("verification_status", "verification_status", { unique: false });
        }
        if (!database.objectStoreNames.contains(META_STORE)) {
          database.createObjectStore(META_STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("INDEXEDDB_OPEN_FAILED"));
    });
    return dbPromise;
  }

  function transaction(mode) {
    return openDb().then(db => ({
      db,
      objectStore: db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)
    }));
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("INDEXEDDB_REQUEST_FAILED"));
    });
  }

  function allStoreTransaction(mode) {
    return openDb().then(db => {
      const tx = db.transaction([STORE_NAME, META_STORE], mode);
      return {
        db,
        evidenceStore: tx.objectStore(STORE_NAME),
        metaStore: tx.objectStore(META_STORE),
        tx
      };
    });
  }

  async function putEvidence(item) {
    const nodeId = String(item?.node_id ?? "");
    const text = typeof item?.text === "string" ? item.text : "";
    const contentSha = String(item?.content_sha256 ?? "").toLowerCase();
    if (!nodeId) throw new Error("EVIDENCE_NODE_ID_MISSING");
    if (!HEX_SHA256.test(contentSha)) throw new Error("EVIDENCE_CONTENT_HASH_MISSING");
    if (!text) throw new Error("EVIDENCE_TEXT_MISSING");
    if (String(item?.verification_status ?? "") !== "verified") {
      throw new Error("EVIDENCE_NOT_VERIFIED");
    }

    const actualSha = await sha256Text(text);
    if (actualSha !== contentSha) throw new Error("EVIDENCE_CONTENT_HASH_MISMATCH");

    const record = {
      node_id: nodeId,
      content_sha256: contentSha,
      verification_status: "verified",
      title: String(item?.title ?? ""),
      text,
      citation: String(item?.citation ?? ""),
      source_id: String(item?.source_id ?? item?.sourceId ?? ""),
      language: String(item?.language ?? ""),
      updated_at: new Date().toISOString()
    };

    const { evidenceStore, metaStore, tx } = await allStoreTransaction("readwrite");
    evidenceStore.put(record);
    metaStore.put({
      id: "evidence",
      snapshot_sha256: null,
      dirty: true,
      sequence: 0,
      updated_at: new Date().toISOString()
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("INDEXEDDB_WRITE_FAILED"));
      tx.onabort = () => reject(tx.error || new Error("INDEXEDDB_WRITE_ABORTED"));
    });
    return Object.freeze(record);
  }

  async function bulkPutEvidence(items = []) {
    const accepted = [];
    for (const item of items) {
      accepted.push(await putEvidence(item));
    }
    return Object.freeze(accepted);
  }

  async function countEvidence() {
    const { objectStore } = await transaction("readonly");
    return Number(await requestToPromise(objectStore.count()));
  }

  async function getEvidence(nodeId) {
    const { objectStore } = await transaction("readonly");
    return requestToPromise(objectStore.get(String(nodeId)));
  }

  async function getAllEvidence() {
    const { objectStore } = await transaction("readonly");
    return (await requestToPromise(objectStore.getAll())).filter(item =>
      item?.verification_status === "verified" && HEX_SHA256.test(String(item?.content_sha256 ?? ""))
    );
  }

  async function searchEvidence(query, { limit = 20 } = {}) {
    const searchVariants = variants(query).map(normalizeQuery);
    const records = await getAllEvidence();
    const scored = [];

    for (const record of records) {
      const haystack = normalizeQuery(record.text + " " + record.title + " " + record.citation);
      let score = 0;
      for (const variant of searchVariants) {
        if (!variant) continue;
        if (haystack === variant) score = Math.max(score, 100);
        else if (haystack.includes(variant)) score = Math.max(score, 60);
        else {
          const terms = variant.split(" ").filter(Boolean);
          const matched = terms.filter(term => haystack.includes(term)).length;
          score = Math.max(score, terms.length ? Math.round(30 * matched / terms.length) : 0);
        }
      }
      if (score > 0) scored.push({ record, score });
    }

    scored.sort((a, b) => b.score - a.score || a.record.node_id.localeCompare(b.record.node_id));
    return Object.freeze(scored.slice(0, Math.max(1, Math.min(100, Number(limit) || 20))).map(({record, score}) => ({
      ...record,
      search_score: score
    })));
  }

  function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
    }
    return value;
  }

  async function exportEvidenceBundle() {
    const records = (await getAllEvidence()).sort((a, b) => a.node_id.localeCompare(b.node_id));
    const payload = {
      schema_version: "1.0.0",
      format: "dinullah/omega-offline-evidence-bundle",
      generated_at: new Date().toISOString(),
      count: records.length,
      integrity: {
        algorithm: "omega-merkle-sha256-v1",
        merkle_root_sha256: await merkleRoot(records)
      },
      records
    };
    const canonical = JSON.stringify(canonicalize(payload)) + "\n";
    const bundleSha = await sha256Text(canonical);
    return Object.freeze({
      ...payload,
      bundle_sha256: bundleSha
    });
  }

  async function exportEvidenceBundleText() {
    return JSON.stringify(await exportEvidenceBundle(), null, 2) + "\n";
  }

  async function computeEvidenceSnapshotRoot() {
    return (await merkleRoot((await getAllEvidence()).sort((a, b) => a.node_id.localeCompare(b.node_id)))).toLowerCase();
  }

  async function markManagedSnapshot(snapshotSha256, sequence = 0) {
    if (!HEX_SHA256.test(String(snapshotSha256 ?? ""))) throw new Error("SYNC_SNAPSHOT_HASH_INVALID");
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readwrite");
      tx.objectStore(META_STORE).put({
        id: "evidence",
        snapshot_sha256: String(snapshotSha256).toLowerCase(),
        dirty: false,
        sequence: Math.max(0, Number(sequence) || 0),
        updated_at: new Date().toISOString()
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error("SYNC_STATE_WRITE_FAILED"));
      tx.onabort = () => reject(tx.error || new Error("SYNC_STATE_WRITE_ABORTED"));
    });
  }

  async function getManagedSnapshotState() {
    const db = await openDb();
    const current = await new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readonly");
      const request = tx.objectStore(META_STORE).get("evidence");
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("SYNC_STATE_READ_FAILED"));
    });

    if (current?.dirty === false && HEX_SHA256.test(String(current.snapshot_sha256 ?? ""))) {
      return Object.freeze(current);
    }

    const snapshot = await computeEvidenceSnapshotRoot();
    await markManagedSnapshot(snapshot, current?.sequence || 0);
    return Object.freeze({
      id: "evidence",
      snapshot_sha256: snapshot,
      dirty: false,
      sequence: Math.max(0, Number(current?.sequence) || 0)
    });
  }

  async function finalizeImportedBundle(bundle) {
    const root = String(bundle?.integrity?.merkle_root_sha256 ?? "").toLowerCase();
    if (!HEX_SHA256.test(root)) throw new Error("OFFLINE_BUNDLE_MERKLE_HASH_INVALID");
    await markManagedSnapshot(root, Number(bundle?.sequence) || 0);
    return root;
  }

  async function importEvidenceBundle(bundle) {
    if (!bundle || typeof bundle !== "object") throw new Error("OFFLINE_BUNDLE_INVALID");
    if (bundle.schema_version !== "1.0.0" || bundle.format !== "dinullah/omega-offline-evidence-bundle") {
      throw new Error("OFFLINE_BUNDLE_SCHEMA_UNSUPPORTED");
    }
    if (!Array.isArray(bundle.records)) throw new Error("OFFLINE_BUNDLE_RECORDS_INVALID");
    const claimed = String(bundle.bundle_sha256 ?? "").toLowerCase();
    if (!HEX_SHA256.test(claimed)) throw new Error("OFFLINE_BUNDLE_HASH_MISSING");

    const payload = {
      schema_version: bundle.schema_version,
      format: bundle.format,
      generated_at: bundle.generated_at,
      count: bundle.count,
      ...(bundle.integrity ? { integrity: bundle.integrity } : {}),
      records: [...bundle.records].sort((a, b) => String(a?.node_id ?? "").localeCompare(String(b?.node_id ?? "")))
    };
    const canonical = JSON.stringify(canonicalize(payload)) + "\n";
    const actual = await sha256Text(canonical);
    if (actual !== claimed) throw new Error("OFFLINE_BUNDLE_HASH_MISMATCH");
    if (Number(bundle.count) !== bundle.records.length) throw new Error("OFFLINE_BUNDLE_COUNT_MISMATCH");
    if (bundle.integrity?.merkle_root_sha256) {
      const expectedRoot = String(bundle.integrity.merkle_root_sha256).toLowerCase();
      if (!HEX_SHA256.test(expectedRoot)) throw new Error("OFFLINE_BUNDLE_MERKLE_HASH_INVALID");
      const actualRoot = (await merkleRoot(payload.records)).toLowerCase();
      if (actualRoot !== expectedRoot) throw new Error("OFFLINE_BUNDLE_MERKLE_MISMATCH");
    }

    const verified = [];
    for (const record of bundle.records) verified.push(await putEvidence(record));
    if (bundle.integrity?.merkle_root_sha256) {
      const actualRoot = (await merkleRoot(verified.slice().sort((a, b) => a.node_id.localeCompare(b.node_id)))).toLowerCase();
      if (actualRoot !== String(bundle.integrity.merkle_root_sha256).toLowerCase()) {
        throw new Error("OFFLINE_BUNDLE_MERKLE_MISMATCH");
      }
      await markManagedSnapshot(actualRoot, Number(bundle.sequence) || 0);
    }
    return Object.freeze({ imported: verified.length, bundle_sha256: actual, snapshot_sha256: bundle.integrity?.merkle_root_sha256 ?? null });
  }

  async function importEvidenceBundleFile(file, { workerUrl = "./omega-offline-evidence-worker.js", mainThreadFallbackMaxBytes = 4 * 1024 * 1024 } = {}) {
    if (!file || typeof file.text !== "function") throw new Error("OFFLINE_BUNDLE_FILE_INVALID");

    if (typeof Worker !== "function") {
      if (Number(file.size || 0) > mainThreadFallbackMaxBytes) {
        throw new Error("OFFLINE_INTEGRITY_WORKER_UNAVAILABLE");
      }
      return importEvidenceBundle(JSON.parse(await file.text()));
    }

    const url = new URL(workerUrl, location.href);
    if (url.origin !== location.origin) throw new Error("OFFLINE_INTEGRITY_WORKER_MUST_BE_SAME_ORIGIN");

    const worker = new Worker(url);
    return await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, result) => {
        if (settled) return;
        settled = true;
        worker.terminate();
        if (error) reject(error);
        else resolve(result);
      };

      worker.onmessage = event => {
        const message = event.data || {};
        if (message.type === "progress") {
          window.dispatchEvent(new CustomEvent("deenallah:omega-integrity-progress", { detail: message }));
          return;
        }
        if (message.type === "result") {
          if (message.ok) finish(null, message.result);
          else finish(new Error(String(message.error || "OFFLINE_BUNDLE_REJECTED")));
        }
      };
      worker.onerror = event => finish(new Error(String(event.message || "OFFLINE_INTEGRITY_WORKER_FAILED")));
      try {
        worker.postMessage({ type: "import-file", file });
      } catch (error) {
        finish(error);
      }
    });
  }

  async function clearEvidence() {
    const { evidenceStore, metaStore, tx } = await allStoreTransaction("readwrite");
    evidenceStore.clear();
    metaStore.put({
      id: "evidence",
      snapshot_sha256: null,
      dirty: true,
      sequence: 0,
      updated_at: new Date().toISOString()
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("INDEXEDDB_CLEAR_FAILED"));
      tx.onabort = () => reject(tx.error || new Error("INDEXEDDB_CLEAR_ABORTED"));
    });
  }

  window.deenAllahOmegaLocalStore = Object.freeze({
    putEvidence,
    bulkPutEvidence,
    getEvidence,
    getAllEvidence,
    searchEvidence,
    countEvidence,
    clearEvidence,
    normalizeQuery,
    queryVariants: variants,
    exportEvidenceBundle,
    exportEvidenceBundleText,
    importEvidenceBundle,
    importEvidenceBundleFile,
    computeEvidenceSnapshotRoot,
    markManagedSnapshot,
    getManagedSnapshotState,
    finalizeImportedBundle
  });
  window.dispatchEvent(new CustomEvent("deenallah:omega-store-ready"));
})();
