export function createSupabaseStore({
  url = process.env.SUPABASE_URL, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY, fetchImpl = globalThis.fetch
} = {}) {
  const enabled = Boolean(url && serviceKey && typeof fetchImpl === "function");
  async function insert(table, row) {
    if (!enabled) return { skipped: true, reason: "SUPABASE_NOT_CONFIGURED" };
    const response = await fetchImpl(url.replace(/\/$/, "") + "/rest/v1/" + encodeURIComponent(table), {
      method: "POST",
      headers: { "content-type": "application/json", apikey: serviceKey, authorization: "Bearer " + serviceKey, prefer: "return=representation" },
      body: JSON.stringify(row)
    });
    if (!response.ok) throw new Error("Supabase insert HTTP " + response.status);
    return response.json();
  }
  return Object.freeze({ enabled, insert });
}
