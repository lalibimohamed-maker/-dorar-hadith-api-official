const DEFAULT_BASE = "https://api.sunnah.com/v1";

function baseUrl() {
  return String(process.env.SUNNAH_API_BASE || DEFAULT_BASE).replace(/\/$/, "");
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
    headers: { accept: "application/json", "X-API-Key": key },
    signal
  });
  if (!response.ok) throw new Error(`Sunnah.com API returned HTTP ${response.status}`);
  return response.json();
}

export async function getSunnahCollections({ signal } = {}) {
  return request("/collections", { signal });
}

export async function getSunnahCollection(collection, { signal } = {}) {
  if (!collection) throw new Error("collection is required");
  return request(`/collections/${encodeURIComponent(collection)}`, { signal });
}

export async function getSunnahHadiths({ collection, bookNumber, chapterId, hadithNumber, limit, page, signal } = {}) {
  const params = new URLSearchParams();
  if (collection) params.set("collection", collection);
  if (bookNumber) params.set("bookNumber", String(bookNumber));
  if (chapterId) params.set("chapterId", String(chapterId));
  if (hadithNumber) params.set("hadithNumber", String(hadithNumber));
  if (limit != null) params.set("limit", String(limit));
  if (page != null) params.set("page", String(page));
  return request(`/hadiths?${params}`, { signal });
}

export async function getSunnahHadithByRefs(refs, { signal } = {}) {
  if (!Array.isArray(refs) || refs.length === 0) throw new Error("refs is required");
  return request(`/hadiths/refs?refs=${encodeURIComponent(refs.join(","))}`, { signal });
}

export async function getSunnahHadithByUrns(urns, { signal } = {}) {
  if (!Array.isArray(urns) || urns.length === 0) throw new Error("urns is required");
  return request(`/hadiths/urns?urns=${encodeURIComponent(urns.join(","))}`, { signal });
}
