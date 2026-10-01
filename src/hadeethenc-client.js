const BASE_URL = "https://hadeethenc.com/api/v1";
function required(value, name) { if (value === undefined || value === null || value === "") throw new TypeError(name + " is required"); return String(value); }
async function getJson(path, params = {}) {
  const url = new URL(BASE_URL + path);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  const response = await fetch(url, { method: "GET", headers: { accept: "application/json", "user-agent": "DinAllah-Rechercher/1.0" } });
  if (!response.ok) throw new Error("HadeethEnc API request failed: " + response.status + " " + response.statusText);
  return response.json();
}
export function hadeethEncApiInfo() { return { id: "hadeethenc-api", baseUrl: BASE_URL, auth: "none", rightsGate: "required-before-Corpus-or-public-release", source: "HadeethEnc" }; }
export function hadeethEncLanguages() { return getJson("/languages"); }
export function hadeethEncCategories(language) { return getJson("/categories/list/", { language: required(language, "language") }); }
export function hadeethEncRootCategories(language) { return getJson("/categories/roots/", { language: required(language, "language") }); }
export function hadeethEncList({ language, categoryId, page = 1, perPage = 20 } = {}) { return getJson("/hadeeths/list/", { language: required(language, "language"), category_id: required(categoryId, "categoryId"), page, per_page: perPage }); }
export function hadeethEncHadith({ language = "ar", id } = {}) { return getJson("/hadeeths/one/", { language: required(language, "language"), id: required(id, "id") }); }
