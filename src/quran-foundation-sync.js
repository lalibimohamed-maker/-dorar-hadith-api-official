const CONTENT_BASE = process.env.QF_ENV === "production"
  ? "https://apis.quran.foundation/content"
  : "https://apis-prelive.quran.foundation/content";
const AUTH_BASE = process.env.QF_ENV === "production"
  ? "https://oauth2.quran.foundation"
  : "https://prelive-oauth2.quran.foundation";

let token;
let expiresAt = 0;

async function accessToken() {
  if (!process.env.QF_CLIENT_ID || !process.env.QF_CLIENT_SECRET) {
    const error = new Error("Quran Foundation credentials are not configured");
    error.code = "QF_NOT_CONFIGURED";
    throw error;
  }
  if (token && Date.now() < expiresAt - 60000) return token;
  const credentials = Buffer.from(`${process.env.QF_CLIENT_ID}:${process.env.QF_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${AUTH_BASE}/oauth2/token`, {
    method: "POST",
    headers: { authorization: `Basic ${credentials}`, "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=content"
  });
  if (!response.ok) throw new Error(`Quran Foundation token request failed: ${response.status}`);
  const data = await response.json();
  token = data.access_token;
  expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  return token;
}

async function qf(path) {
  const response = await fetch(CONTENT_BASE + path, {
    headers: { "x-auth-token": await accessToken(), "x-client-id": process.env.QF_CLIENT_ID }
  });
  if (!response.ok) throw new Error(`Quran Foundation request failed: ${response.status}`);
  return response.json();
}

export async function syncQuranFoundation({ resources, syncToken = null } = {}) {
  const filter = Array.isArray(resources) ? resources.filter(Boolean).join(";") : String(resources || "");
  if (!filter) throw new Error("resources filter is required");
  const params = new URLSearchParams({ resources: filter, per_page: "100" });
  if (syncToken) params.set("sync_token", syncToken);
  else params.set("bootstrap", "true");
  const pages = [];
  let path = `/api/v4/resources/sync?${params}`;
  let finalToken = null;
  while (path) {
    const page = await qf(path);
    pages.push(page);
    if (page.has_more && page.next_page_url) path = page.next_page_url;
    else {
      finalToken = page.next_sync_token || null;
      path = null;
    }
  }
  return {
    provider: "quran-foundation",
    resourcesFilter: filter,
    pages,
    nextSyncToken: finalToken,
    policy: "sync-cache-only; verification required before any corpus or release persistence"
  };
}
