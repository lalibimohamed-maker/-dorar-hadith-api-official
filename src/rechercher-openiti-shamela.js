const OPENITI_METADATA_API = "https://dev-kitab-metadata-api.azurewebsites.net";
const OPENITI_RAW = "https://raw.githubusercontent.com/OpenITI/RELEASE";
const SHAMELA_DEFAULT_BOOKS_ENDPOINT = "https://shamela.ws/api/books";
const SHAMELA_DEFAULT_MASTER_ENDPOINT = "https://shamela.ws/api/master_patch";

function shamelaConfig() {
  return {
    apiKey: process.env.SHAMELA_API_KEY || "",
    booksEndpoint: process.env.SHAMELA_API_BOOKS_ENDPOINT || SHAMELA_DEFAULT_BOOKS_ENDPOINT,
    masterPatchEndpoint: process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT || SHAMELA_DEFAULT_MASTER_ENDPOINT
  };
}

function requireShamelaKey() {
  const key = shamelaConfig().apiKey;
  if (!key) throw new Error("SHAMELA_API_KEY is required for Shamela runtime API calls");
  return key;
}

async function shamelaGet(endpoint, path, { signal } = {}) {
  const config = shamelaConfig();
  const key = requireShamelaKey();
  const base = endpoint.replace(/\\/+$/, "");
  const url = new URL(base + "/" + path.replace(/^\\/+/, ""));
  url.searchParams.set("api_key", key);
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json", "user-agent": "DinAllah-Rechercher/1.0" },
    redirect: "error",
    signal
  });
  if (!response.ok) throw new Error(`Shamela API returned HTTP ${response.status}`);
  return response.json();
}

export function shamelaRuntimeConfig() {
  const config = shamelaConfig();
  return {
    configured: Boolean(config.apiKey),
    booksEndpoint: config.booksEndpoint,
    masterPatchEndpoint: config.masterPatchEndpoint,
    apiKey: undefined
  };
}

export async function shamelaMasterMetadata({ version, signal } = {}) {
  const suffix = version === undefined ? "" : "/" + encodeURIComponent(String(version));
  return shamelaGet(shamelaConfig().masterPatchEndpoint, suffix, { signal });
}

export async function shamelaBookMetadata(bookId, { signal } = {}) {
  const id = Number(bookId);
  if (!Number.isInteger(id) || id < 1) throw new TypeError("bookId must be a positive integer");
  return shamelaGet(shamelaConfig().booksEndpoint, String(id), { signal });
}

export async function shamelaBook(bookId, { signal } = {}) {
  const id = Number(bookId);
  if (!Number.isInteger(id) || id < 1) throw new TypeError("bookId must be a positive integer");
  return shamelaGet(shamelaConfig().booksEndpoint, String(id), { signal });
}


function required(value, name) {
  if (value === undefined || value === null || value === "") throw new TypeError(name + " is required");
  return String(value);
}

async function getJson(url, { signal } = {}) {
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json", "user-agent": "DinAllah-Rechercher/1.0" },
    redirect: "error",
    signal
  });
  if (!response.ok) throw new Error(`OpenITI connector returned HTTP ${response.status}`);
  return response.json();
}

function safeRelease(release) {
  return required(release, "release").replace(/[^A-Za-z0-9._-]/g, "");
}

export function openItiConnectorInfo() {
  return {
    id: "openiti",
    runtime: "metadata-api-and-raw-release",
    metadataBaseUrl: OPENITI_METADATA_API,
    rawReleaseBaseUrl: OPENITI_RAW,
    rightsGate: "dataset-specific",
    corpusWrite: "never-direct",
    sourceTextPolicy: "read-from-openiti-only"
  };
}

export async function openItiVersion(versionUri, { signal } = {}) {
  const uri = required(versionUri, "versionUri");
  const parsed = new URL(uri);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("OpenITI version URI must be http(s)");
  const endpoint = OPENITI_METADATA_API + "/2023.1.8/version/" + encodeURIComponent(uri.split("/").pop());
  return getJson(endpoint, { signal });
}

export function openItiRawTextUrl({ release = "v2025.1.9", path } = {}) {
  const rel = safeRelease(release);
  const cleanPath = required(path, "path").replace(/^\/+/, "");
  if (cleanPath.includes("..")) throw new Error("path traversal is not allowed");
  return OPENITI_RAW + "/" + rel + "/" + cleanPath;
}

export async function openItiRawText({ release = "v2025.1.9", path, signal } = {}) {
  const url = openItiRawTextUrl({ release, path });
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "text/plain", "user-agent": "DinAllah-Rechercher/1.0" },
    redirect: "error",
    signal
  });
  if (!response.ok) throw new Error(`OpenITI raw text returned HTTP ${response.status}`);
  return response.text();
}

export function openItiConnectorHealth() {
  return {
    openiti: {
      runtime: "metadata-api-and-raw-release",
      configured: true,
      supportedReleaseExample: "v2025.1.9"
    }
  };
}

export function shamelaDiscoveryUrl(query) {
  const q = required(query, "query");
  return "https://shamela.ws/search?query=" + encodeURIComponent(q);
}

export function shamelaConnectorInfo() {
  return {
    id: "shamela",
    runtime: "api-key-configurable",
    rightsGate: "source-specific",
    corpusWrite: "never-direct",
    apiKeyRequired: true,
    endpoints: { masterMetadata: SHAMELA_DEFAULT_MASTER_ENDPOINT, books: SHAMELA_DEFAULT_BOOKS_ENDPOINT },
    note: "Runtime API connector is executable and key-gated; no key is stored in source."
  };
}
