import { isBookCacheSafe } from "./book-cache-policy.js";

const DB_NAME = "deen-allah-offline-library";
const DB_VERSION = 1;
const BOOKS_STORE = "books";
const PDF_CACHE = "deen-allah-pdf-v1";

function requireBook(book) {
  if (!book || typeof book !== "object") throw new TypeError("book is required");
  if (!book.id || !book.url) throw new TypeError("book.id and book.url are required");
  if (!book.sha256) throw new TypeError("book.sha256 is required for integrity verification");
  if (!Number.isInteger(book.sizeBytes) || book.sizeBytes < 1) throw new TypeError("book.sizeBytes must be a positive integer");
  if (!isBookCacheSafe(book)) throw new Error("Book is not approved for offline caching by the governed rights/provenance policy");
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error("IndexedDB is unavailable"));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        db.createObjectStore(BOOKS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open offline library"));
  });
}

async function putMetadata(record) {
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKS_STORE, "readwrite");
      tx.objectStore(BOOKS_STORE).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("Failed to store offline metadata"));
    });
  } finally {
    db.close();
  }
}

export async function getOfflineBook(id) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKS_STORE, "readonly");
      const request = tx.objectStore(BOOKS_STORE).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Failed to read offline metadata"));
    });
  } finally {
    db.close();
  }
}

export async function listOfflineBooks() {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKS_STORE, "readonly");
      const request = tx.objectStore(BOOKS_STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("Failed to list offline books"));
    });
  } finally {
    db.close();
  }
}

export async function removeOfflineBook(id) {
  const record = await getOfflineBook(id);
  const db = await openDatabase();
  try {
    if (record?.url && globalThis.caches) {
      const cache = await caches.open(PDF_CACHE);
      await cache.delete(record.url);
    }
    await new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKS_STORE, "readwrite");
      tx.objectStore(BOOKS_STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("Failed to remove offline metadata"));
    });
  } finally {
    db.close();
  }
}

export async function verifySha256(blob, expectedSha256) {
  if (!(blob instanceof Blob)) throw new TypeError("blob must be a Blob");
  if (!expectedSha256 || !/^[a-f0-9]{64}$/i.test(expectedSha256)) throw new TypeError("expectedSha256 must be a SHA-256 hex digest");
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  const actual = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return actual.toLowerCase() === expectedSha256.toLowerCase();
}

export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

export async function storageEstimate() {
  if (!navigator.storage?.estimate) return { usage: 0, quota: 0 };
  const estimate = await navigator.storage.estimate();
  return { usage: estimate.usage || 0, quota: estimate.quota || 0 };
}

export async function downloadPdfForOffline(book, { onProgress } = {}) {
  requireBook(book);
  if (!globalThis.fetch || !globalThis.caches) throw new Error("This browser does not support offline PDF storage");

  const response = await fetch(book.url, { credentials: "omit" });
  if (!response.ok) throw new Error(`PDF download failed: HTTP ${response.status}`);

  const contentLength = Number(response.headers.get("content-length") || book.sizeBytes);
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (contentType && !contentType.includes("application/pdf") && !book.url.toLowerCase().endsWith(".pdf")) {
    throw new Error("Downloaded resource is not identified as a PDF");
  }

  const reader = response.body?.getReader();
  let blob;
  if (!reader) {
    blob = await response.blob();
    onProgress?.(100);
  } else {
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      onProgress?.(contentLength ? Math.min(99, Math.round((received / contentLength) * 100)) : null);
    }
    blob = new Blob(chunks, { type: "application/pdf" });
    onProgress?.(100);
  }

  if (blob.size !== book.sizeBytes) throw new Error(`PDF size mismatch: expected ${book.sizeBytes}, received ${blob.size}`);
  if (!(await verifySha256(blob, book.sha256))) throw new Error("PDF SHA-256 verification failed");

  const cache = await caches.open(PDF_CACHE);
  await cache.put(book.url, new Response(blob, {
    status: 200,
    headers: { "Content-Type": "application/pdf", "Content-Length": String(blob.size), "X-Offline-SHA256": book.sha256 }
  }));

  await putMetadata({
    ...book,
    sizeBytes: blob.size,
    cachedAt: new Date().toISOString(),
    state: "cached",
    version: book.version || 1,
  });
  return { ...book, sizeBytes: blob.size, state: "cached" };
}

export async function openOfflinePdf(id) {
  const book = await getOfflineBook(id);
  if (!book || book.state !== "cached") return null;
  const cache = await caches.open(PDF_CACHE);
  const response = await cache.match(book.url);
  if (!response) return null;
  return { book, response };
}

export async function registerOfflineServiceWorker(scriptUrl = "/sw.js") {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register(scriptUrl, { scope: "/" });
}
