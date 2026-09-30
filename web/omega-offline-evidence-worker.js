const DB_NAME = "deen-allah-omega-local-v1";
const DB_VERSION = 2;
const STORE_NAME = "evidence";
const HEX_SHA256 = /^[a-f0-9]{64}$/i;
const BUNDLE_FORMAT = "dinullah/omega-offline-evidence-bundle";
const BUNDLE_SCHEMA = "1.0.0";

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

async function sha256Text(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function merkleRoot(records) {
  let level = [];
  for (const record of records) {
    const leafMaterial = "dinullah:omega:evidence:leaf:v1\u0000" + String(record?.node_id ?? "") + "\u0000" + String(record?.content_sha256 ?? "").toLowerCase();
    level.push(await sha256Text(leafMaterial));
  }
  if (!level.length) return await sha256Text("dinullah:omega:evidence:empty:v1\u0000");
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || left;
      next.push(await sha256Text("dinullah:omega:evidence:parent:v1\u0000" + left + "\u0000" + right));
    }
    level = next;
    self.postMessage({ type: "progress", stage: "merkle", completed: level.length, total: 0 });
  }
  return level[0];
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "node_id" });
        store.createIndex("source_id", "source_id", { unique: false });
        store.createIndex("verification_status", "verification_status", { unique: false });
      }
      if (!db.objectStoreNames.contains("sync_state")) {
        db.createObjectStore("sync_state", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("INDEXEDDB_OPEN_FAILED"));
  });
}

async function putRecords(records, snapshotSha256, sequence = 0) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, "sync_state"], "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const meta = tx.objectStore("sync_state");
    for (const record of records) store.put(record);
    meta.put({
      id: "evidence",
      snapshot_sha256: String(snapshotSha256).toLowerCase(),
      dirty: false,
      sequence: Math.max(0, Number(sequence) || 0),
      updated_at: new Date().toISOString()
    });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error("INDEXEDDB_WRITE_FAILED"));
    tx.onabort = () => reject(tx.error || new Error("INDEXEDDB_WRITE_ABORTED"));
  });
}

async function importBundleFile(file) {
  if (!file || typeof file.text !== "function") throw new Error("OFFLINE_BUNDLE_FILE_INVALID");
  self.postMessage({ type: "progress", stage: "reading", completed: 0, total: 0 });
  const raw = await file.text();
  let bundle;
  try { bundle = JSON.parse(raw); } catch { throw new Error("OFFLINE_BUNDLE_JSON_INVALID"); }

  if (!bundle || typeof bundle !== "object") throw new Error("OFFLINE_BUNDLE_INVALID");
  if (bundle.schema_version !== BUNDLE_SCHEMA || bundle.format !== BUNDLE_FORMAT) throw new Error("OFFLINE_BUNDLE_SCHEMA_UNSUPPORTED");
  if (!Array.isArray(bundle.records)) throw new Error("OFFLINE_BUNDLE_RECORDS_INVALID");

  const claimedBundleHash = String(bundle.bundle_sha256 ?? "").toLowerCase();
  if (!HEX_SHA256.test(claimedBundleHash)) throw new Error("OFFLINE_BUNDLE_HASH_MISSING");

  const sortedRecords = [...bundle.records].sort((a, b) => String(a?.node_id ?? "").localeCompare(String(b?.node_id ?? "")));
  const payload = {
    schema_version: bundle.schema_version,
    format: bundle.format,
    generated_at: bundle.generated_at,
    count: bundle.count,
    ...(bundle.integrity ? { integrity: bundle.integrity } : {}),
    records: sortedRecords
  };

  self.postMessage({ type: "progress", stage: "bundle-hash", completed: 0, total: 1 });
  const actualBundleHash = await sha256Text(JSON.stringify(canonicalize(payload)) + "\n");
  if (actualBundleHash !== claimedBundleHash) throw new Error("OFFLINE_BUNDLE_HASH_MISMATCH");
  if (Number(bundle.count) !== bundle.records.length) throw new Error("OFFLINE_BUNDLE_COUNT_MISMATCH");

  const verified = [];
  for (let index = 0; index < sortedRecords.length; index += 1) {
    const record = sortedRecords[index];
    const nodeId = String(record?.node_id ?? "");
    const text = typeof record?.text === "string" ? record.text : "";
    const claimed = String(record?.content_sha256 ?? "").toLowerCase();
    if (!nodeId) throw new Error("EVIDENCE_NODE_ID_MISSING");
    if (!HEX_SHA256.test(claimed)) throw new Error("EVIDENCE_CONTENT_HASH_MISSING");
    if (!text) throw new Error("EVIDENCE_TEXT_MISSING");
    if (String(record?.verification_status ?? "") !== "verified") throw new Error("EVIDENCE_NOT_VERIFIED");

    const actual = await sha256Text(text);
    if (actual !== claimed) throw new Error("EVIDENCE_CONTENT_HASH_MISMATCH");
    verified.push({
      node_id: nodeId,
      content_sha256: claimed,
      verification_status: "verified",
      title: String(record?.title ?? ""),
      text,
      citation: String(record?.citation ?? ""),
      source_id: String(record?.source_id ?? record?.sourceId ?? ""),
      language: String(record?.language ?? ""),
      updated_at: String(record?.updated_at ?? new Date().toISOString())
    });
    if (index % 8 === 0 || index === sortedRecords.length - 1) {
      self.postMessage({ type: "progress", stage: "records", completed: index + 1, total: sortedRecords.length });
    }
  }

  if (bundle.integrity?.merkle_root_sha256) {
    self.postMessage({ type: "progress", stage: "merkle", completed: 0, total: sortedRecords.length });
    const expectedRoot = String(bundle.integrity.merkle_root_sha256).toLowerCase();
    const actualRoot = (await merkleRoot(verified)).toLowerCase();
    if (!HEX_SHA256.test(expectedRoot) || actualRoot !== expectedRoot) throw new Error("OFFLINE_BUNDLE_MERKLE_MISMATCH");
  }

  self.postMessage({ type: "progress", stage: "writing", completed: 0, total: verified.length });
  const snapshotSha256 = bundle.integrity?.merkle_root_sha256
    ? String(bundle.integrity.merkle_root_sha256).toLowerCase()
    : (await merkleRoot(verified)).toLowerCase();
  await putRecords(verified, snapshotSha256, bundle.sequence);
  self.postMessage({ type: "progress", stage: "writing", completed: verified.length, total: verified.length });
  return { imported: verified.length, bundle_sha256: actualBundleHash, snapshot_sha256: snapshotSha256 };
}

self.addEventListener("message", event => {
  const message = event.data || {};
  if (message.type !== "import-file") return;
  importBundleFile(message.file)
    .then(result => self.postMessage({ type: "result", ok: true, result }))
    .catch(error => self.postMessage({ type: "result", ok: false, error: String(error?.message ?? error) }));
});
