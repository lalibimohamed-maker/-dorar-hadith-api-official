(() => {
  const DB_NAME = "deen-allah-omega-local-v1";
  const DB_VERSION = 1;
  const STORE_NAME = "evidence";
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

    const { objectStore } = await transaction("readwrite");
    await requestToPromise(objectStore.put(record));
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

  async function clearEvidence() {
    const { objectStore } = await transaction("readwrite");
    await requestToPromise(objectStore.clear());
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
    queryVariants: variants
  });
  window.dispatchEvent(new CustomEvent("deenallah:omega-store-ready"));
})();
