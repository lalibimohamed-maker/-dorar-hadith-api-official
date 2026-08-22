const params = new URLSearchParams(location.search);
const savedBase = localStorage.getItem("deenAllahApiBase") || "";
const apiBase = (params.get("api") || savedBase).replace(/\/$/, "");
const $ = (id) => document.getElementById(id);

function show(id, value) { const el = $(id); if (el) el.innerHTML = value; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
function endpoint(path) { return `${apiBase}${path}`; }

async function api(path, options = {}) {
  const res = await fetch(endpoint(path), { headers: { Accept: "application/json", ...(options.headers || {}) }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function checkApi() {
  if (!apiBase) {
    show("api-status", "⚠️ الواجهة جاهزة، لكن عنوان API لم يُضبط بعد. ضع عنوان الخدمة في إعدادات الربط أدناه.");
    return false;
  }
  try {
    const data = await api("/health");
    show("api-status", `🟢 API متصل — ${escapeHtml(data.name || "موسوعة دين الله")} — الإصدار ${escapeHtml(data.version || "")}`);
    return true;
  } catch (error) {
    show("api-status", `🔴 تعذر الاتصال بالـAPI: ${escapeHtml(error.message)}`);
    return false;
  }
}

async function search() {
  const q = $("query").value.trim();
  if (!q) return;
  show("results", "<p>جارٍ البحث مع حفظ نسبة كل نتيجة إلى مصدرها…</p>");
  try {
    const data = await api(`/search?q=${encodeURIComponent(q)}&lang=ar&includePotentialMatches=true`);
    const results = data.results || data.items || data.hits || [];
    if (!results.length) { show("results", "<p>لم تظهر نتائج مطابقة في المصدر الموصول.</p>"); return; }
    show("results", `<h3>نتائج البحث</h3><div class="result-grid">${results.slice(0, 40).map((r) => `<article class="result"><b>${escapeHtml(r.title || r.name || r.text || "نتيجة")}</b><p>${escapeHtml(r.snippet || r.text || r.description || "")}</p><small>المصدر: ${escapeHtml(r.source || r.sourceName || r.provider || "غير محدد")}</small></article>`).join("")}</div>`);
  } catch (error) {
    show("results", `<p class="error">تعذر تنفيذ البحث: ${escapeHtml(error.message)}</p>`);
  }
}

async function loadSources(category) {
  show("results", "<p>جارٍ تحميل المصادر…</p>");
  try {
    const data = await api(`/sources?category=${encodeURIComponent(category)}`);
    const sources = data.sources || [];
    show("results", `<h3>مصادر ${escapeHtml(category)}</h3><div class="result-grid">${sources.map(s => `<article class="result"><b>${escapeHtml(s.nameAr || s.name || s.id)}</b><p>${escapeHtml(s.role || "مصدر")}</p>${s.url ? `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">فتح المصدر</a>` : ""}</article>`).join("")}</div>`);
  } catch (error) { show("results", `<p class="error">${escapeHtml(error.message)}</p>`); }
}

function saveApi() {
  const value = $("api-base").value.trim().replace(/\/$/, "");
  localStorage.setItem("deenAllahApiBase", value);
  location.search = value ? `?api=${encodeURIComponent(value)}` : "";
}

$("api-base").value = apiBase;
$("search-btn").addEventListener("click", search);
$("query").addEventListener("keydown", e => { if (e.key === "Enter") search(); });
$("save-api").addEventListener("click", saveApi);
$("api-check").addEventListener("click", checkApi);

document.querySelectorAll("[data-category]").forEach(el => el.addEventListener("click", () => loadSources(el.dataset.category)));
checkApi();
