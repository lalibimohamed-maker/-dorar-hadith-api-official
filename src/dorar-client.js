const DORAR_API_URL = "https://dorar.net/dorar_api.json";

function unwrapJsonp(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(trimmed);
  const start = trimmed.indexOf("(");
  const end = trimmed.lastIndexOf(")");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Unexpected response from Dorar.net");
  }
  return JSON.parse(trimmed.slice(start + 1, end));
}

export async function searchDorar(query, { signal } = {}) {
  const q = String(query || "").trim();
  if (!q) throw new Error("Search query is required");

  const endpoint = new URL(DORAR_API_URL);
  endpoint.searchParams.set("skey", q);
  endpoint.searchParams.set("callback", "dorarApiCallback");

  const response = await fetch(endpoint, {
    method: "GET",
    headers: { accept: "application/json, text/javascript, */*" },
    signal
  });

  if (!response.ok) {
    throw new Error(`Dorar.net returned HTTP ${response.status}`);
  }

  return unwrapJsonp(await response.text());
}
