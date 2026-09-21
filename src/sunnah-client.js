const DEFAULT_BASE = "https://api.sunnah.com";

function baseUrl() {
  return String(process.env.SUNNAH_API_BASE || DEFAULT_BASE).replace(/\\/$/, "");
}

function apiKey() {
  return process.env.SUNNAH_API_KEY || "";
}

async function request(path, { signal } = {}) {
  const key = apiKey();
  if (!key) {
    const error = new Error("Sunnah.com API credentials are not configured");
    error.code = "SUNNAH_NOT_CONFIGURED";
    throw error;
  }
  const response = await fetch(baseUrl() + path, {
    headers: { accept: "application/json", "x-api-key": key },
    signal
  });
  if (!response.ok) throw new Error(`Sunnah.com API returned HTTP ${response.status}`);
  return response.json();
}

export async function searchSunnah(query, { signal } = {}) {
  const q = encodeURIComponent(String(query || "").trim());
  if (!q) throw new Error("Search query is required");
  return request(`/search?query=${q}`, { signal });
}

export async function getSunnahCollections({ signal } = {}) {
  return request("/collections", { signal });
}

export async function getSunnahCollection(collection, { signal } = {}) {
  if (!collection) throw new Error("collection is required");
  return request(`/collections/${encodeURIComponent(collection)}`, { signal });
}
