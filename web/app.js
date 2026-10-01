const params = new URLSearchParams(location.search);
const savedBase = localStorage.getItem("deenAllahApiBase") || "";
const apiBase = (params.get("api") || savedBase).replace(/\/$/, "");
const $ = (id) => document.getElementById(id);
const browserLanguage = (navigator.language || "ar").split("-")[0].toLowerCase();
const OMEGA_MODES = new Set(["auto", "offline_only", "online_only"]);
let longPressTimer = null;
let longPressTarget = null;

function show(id, value) { const el = $(id); if (el) el.innerHTML = value; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
function endpoint(path) { return `${apiBase}${path}`; }
function getOmegaMode() {
  const stored = localStorage.getItem("deenAllahOmegaMode");
  return OMEGA_MODES.has(stored) ? stored : "auto";
}
async function api(path, options = {}) {
  const res = await fetch(endpoint(path), { headers: { Accept: "application/json", ...(options.headers || {}) }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
async function omegaDeltaSync({ url, trustedPublicKeys = {} } = {}) {
  if (!url) throw new TypeError("delta update URL is required");
  if (!navigator.serviceWorker?.controller) {
    throw new Error("OFFLINE_DELTA_SERVICE_WORKER_NOT_READY");
  }
  navigator.serviceWorker.controller.postMessage({
    type: "OMEGA_APPLY_EVIDENCE_DELTA",
    url,
    trustedPublicKeys
  });
}

async function registerOfflineAppShell() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("./sw.js", { scope: "./" });
  } catch (error) {
    if (getOmegaMode() === "offline_only") {
      show("api-status", `🟠 وضع عدم الاتصال مفعّل، لكن Service Worker لم يُسجّل: ${escapeHtml(error.message)}`);
    }
    return null;
  }
}
function installLocalProviderBoundary() {
  if (document.getElementById("omega-local-provider-script")) return;
  const script = document.createElement("script");
  script.id = "omega-local-provider-script";
  script.src = "./omega-local-provider.js";
  script.defer = true;
  document.body.appendChild(script);
}
function installMultimodalGuardBoundary() {
  if (document.getElementById("omega-multimodal-context-guard-script")) return;
  const script = document.createElement("script");
  script.id = "omega-multimodal-context-guard-script";
  script.src = "./omega-multimodal-context-guard.js";
  script.defer = true;
  script.async = false;
  document.head.appendChild(script);
}

function installVisualPrunerBoundary() {
  if (document.getElementById("omega-visual-pruner-script")) return;
  const script = document.createElement("script");
  script.id = "omega-visual-pruner-script";
  script.src = "./omega-visual-pruner.js";
  script.defer = true;
  script.async = false;
  document.head.appendChild(script);
}

function installAudioSessionBoundary() {
  if (document.getElementById("omega-audio-session-script")) return;
  const script = document.createElement("script");
  script.id = "omega-audio-session-script";
  script.src = "./omega-audio-session.js";
  script.defer = true;
  script.async = false;
  document.head.appendChild(script);
}
function installHardwareGuardianBoundary() {
  if (document.getElementById("omega-hardware-guardian-script")) return;
  const script = document.createElement("script");
  script.id = "omega-hardware-guardian-script";
  script.src = "./omega-hardware-guardian.js";
  script.defer = true;
  script.async = false;
  document.head.appendChild(script);
}
function installLocalStoreBoundary() {
  if (document.getElementById("omega-local-store-script")) return;
  const script = document.createElement("script");
  script.id = "omega-local-store-script";
  script.src = "./omega-offline-store.js";
  script.defer = true;
  document.body.appendChild(script);
}
function installOfflineOmegaUI() {
  if (document.getElementById("offline-omega-ui-script")) return;
  const script = document.createElement("script");
  script.id = "offline-omega-ui-script";
  script.src = "./offline-omega-ui.js";
  script.defer = true;
  document.body.appendChild(script);
}
function ensureConceptModal() { if ($("concept-modal")) return; const style=document.createElement("style"); style.textContent=".concept-target{touch-action:pan-y;user-select:text;transition:box-shadow .2s,transform .2s}.concept-target.long-press-pending{box-shadow:0 0 0 3px #176b4b55,0 14px 38px #17352a25;transform:scale(.995)}#concept-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px}#concept-modal[hidden]{display:none}.concept-backdrop{position:absolute;inset:0;background:#10251db8;backdrop-filter:blur(3px)}.concept-dialog{position:relative;z-index:1;width:min(760px,94vw);max-height:82vh;overflow:auto;background:#fff;border-radius:24px;border:1px solid #dbe8e0;box-shadow:0 24px 70px #0005;padding:28px;color:#17352a}.concept-dialog h2{margin:0 36px 10px 0;font-size:30px}.concept-close{position:absolute;top:12px;left:14px;border:0;background:#e9f4ee;color:#0d4b36;border-radius:50%;width:40px;height:40px;font-size:28px;cursor:pointer}.concept-meta{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 18px}.concept-meta span{background:#e9f4ee;color:#0d4b36;border-radius:999px;padding:4px 10px;font-size:14px}.concept-text{font-size:21px;line-height:1.9}.concept-policy,.concept-sources,.concept-links{background:#f7fbf8;border:1px solid #dbe8e0;border-radius:16px;padding:14px;margin-top:14px}.concept-dialog details{margin-top:10px}.concept-dialog ol{margin-bottom:0}@media(max-width:600px){.concept-dialog{max-height:86vh;padding:22px 17px}.concept-dialog h2{font-size:26px}.concept-text{font-size:19px}}"; document.head.appendChild(style); const modal=document.createElement("div"); modal.id="concept-modal"; modal.hidden=true; modal.innerHTML='<div class="concept-backdrop" data-close-concept></div><section class="concept-dialog" role="dialog" aria-modal="true" aria-labelledby="concept-title"><button class="concept-close" data-close-concept aria-label="إغلاق">×</button><div id="concept-body"><p>جارٍ التحميل…</p></div></section>'; document.body.appendChild(modal); modal.addEventListener("click",e=>{if(e.target.matches("[data-close-concept]"))closeConcept();}); }
function closeConcept(){const modal=$("concept-modal");if(modal)modal.hidden=true;}
function renderConcept(data){ensureConceptModal();const r=data.record||{};const m=data.methodology||{};const routing=data.routing||{};const primary=Array.isArray(m.primaryBasis)?m.primaryBasis:[];const sourcePriority=Array.isArray(m.sourcePriority)?m.sourcePriority:[];const sections=data.knowledge||{};const text=sections.definition||sections.contextual_meaning||"لا توجد مادة تفسيرية موثقة مرتبطة بهذه الوحدة حتى الآن؛ هذه البطاقة تعرض نطاق التوجيه ومصادر التحقق المتاحة دون توليد نسبة غير موثقة.";$("concept-body").innerHTML=`<h2 id="concept-title">${escapeHtml(data.term||r.title_ar||"المفهوم")}</h2><div class="concept-meta"><span>ضغط مطوّل 5 ثوانٍ</span><span>${escapeHtml(data.language||browserLanguage)}</span>${r.domain?`<span>${escapeHtml(r.domain)}</span>`:""}</div><p class="concept-text">${escapeHtml(text)}</p>${m.mode?`<div class="concept-policy"><b>منهج العرض:</b> ${escapeHtml(m.display?.primaryLabel||m.mode)}<br><b>الأصول الأساسية:</b> ${escapeHtml(primary.join("، ")||"القرآن والسنة الصحيحة")}</div>`:""}${routing.source_classes?`<div class="concept-policy"><b>توجيه المجال:</b> ${escapeHtml(routing.source_classes.join("، "))}</div>`:""}<div class="concept-sources"><b>المصادر والتوثيق</b><p>يُفتح الأصل عند الطلب، ولا تُعرض نسبة قول أو حكم على أنه موثق ما لم يجتز بوابة التحقق.</p>${sourcePriority.length?`<details><summary>ترتيب طبقة المصادر</summary><ol>${sourcePriority.map(s=>`<li>${escapeHtml(s.source||s.label||"مصدر")}</li>`).join("")}</ol></details>`:""}</div>${r.links?.length?`<div class="concept-links"><b>روابط المفهوم:</b> ${r.links.map(x=>`<span>${escapeHtml(x)}</span>`).join(" · ")}</div>`:""};`;$("concept-modal").hidden=false;}
async function openConcept(term,contextId,comparative=false){
  ensureConceptModal();
  $("concept-body").innerHTML=`<p>جارٍ بناء بطاقة <b>${escapeHtml(term)}</b> وفق طبقة المصادر…</p>`;
  $("concept-modal").hidden=false;
  if (getOmegaMode()==="offline_only" || navigator.onLine===false) {
    if (typeof window.deenAllahOmegaLocalConcept==="function") {
      try { renderConcept(await window.deenAllahOmegaLocalConcept({ term, contextId, comparative, language: browserLanguage })); return; } catch {}
    }
    $("concept-body").innerHTML="<p class=\"error\">بطاقة المفهوم المحلية غير متاحة على هذا الجهاز. لم يتم إجراء اتصال بالشبكة.</p>";
    return;
  }
  try{const data=await api(`/api/v1/concept?term=${encodeURIComponent(term)}&context=${encodeURIComponent(contextId||"")}&lang=${encodeURIComponent(browserLanguage)}&comparative=${comparative?"true":"false"}`);renderConcept(data);}catch(error){$("concept-body").innerHTML=`<p class="error">تعذر فتح بطاقة المفهوم: ${escapeHtml(error.message)}</p>`;}
}
function selectedTerm(fallback){const selection=window.getSelection?.();const text=selection?String(selection.toString()||"").trim():"";return text.replace(/\s+/g," ").slice(0,120)||fallback;}
function attachLongPressHandlers(){document.querySelectorAll("[data-concept-id]").forEach(el=>{const start=event=>{if(event.pointerType==="mouse"&&event.button!==0)return;clearTimeout(longPressTimer);longPressTarget=el;el.classList.add("long-press-pending");longPressTimer=setTimeout(()=>{el.classList.remove("long-press-pending");const term=selectedTerm(el.dataset.term||"المفهوم");openConcept(term,el.dataset.conceptId);},5000);};const cancel=()=>{clearTimeout(longPressTimer);longPressTimer=null;if(longPressTarget)longPressTarget.classList.remove("long-press-pending");longPressTarget=null;};el.addEventListener("pointerdown",start,{passive:true});["pointerup","pointercancel","pointerleave"].forEach(type=>el.addEventListener(type,cancel));el.addEventListener("contextmenu",e=>e.preventDefault());});}
function localResultsPayload(data) {
  if (Array.isArray(data)) return { results: data };
  return { results: data?.results || data?.items || data?.hits || [] };
}
function renderSearchResults(data, sourceLabel) {
  const results = localResultsPayload(data).results;
  if(!results.length){show("results",`<p>لم تظهر نتائج مطابقة في ${escapeHtml(sourceLabel)}.</p>`);return;}
  show("results",`<h3>نتائج البحث</h3><p class="muted">المصدر: ${escapeHtml(sourceLabel)} — اضغط مطولاً على أي نتيجة لمدة 5 ثوانٍ لفتح البطاقة.</p><div class="result-grid">${results.slice(0,40).map(r=>`<article class="result concept-target" data-concept-id="${escapeHtml(r.id||r.recordId||r.node_id||"")}" data-term="${escapeHtml(r.title_ar||r.title||r.name||"نتيجة")}"><b>${escapeHtml(r.title_ar||r.title||r.name||"نتيجة")}</b><p>${escapeHtml(r.snippet||r.text||r.description||"اضغط مطولاً لعرض بطاقة المفهوم والتوجيه المنهجي.")}</p><small>المجال: ${escapeHtml(r.domain||"عام")} — ${escapeHtml(r.methodology?.mode||r.verification_status||sourceLabel)}</small></article>`).join("")}</div>`);
  attachLongPressHandlers();
}
async function search(){
  const q=$("query").value.trim();
  if(!q)return;
  window.dispatchEvent(new CustomEvent("deenallah:search:start"));
  try{
    const mode=getOmegaMode();
    const localProvider=typeof window.deenAllahOmegaLocalSearch==="function";
    const localOnly = mode==="offline_only" || (mode==="auto" && navigator.onLine===false);
    if(localOnly){
      if(!localProvider){show("results","<p class=\"error\">الوضع دون اتصال مفعّل، لكن فهرس الأدلة المحلي لم يُحمّل على هذا الجهاز. لم يتم طلب الشبكة.</p>");return;}
      renderSearchResults(await window.deenAllahOmegaLocalSearch(q), "الفهرس المحلي");
      return;
    }
    try{
      const data=await api(`/api/v1/search?q=${encodeURIComponent(q)}&lang=${encodeURIComponent(browserLanguage)}`);
      renderSearchResults(data, "API");
    }catch(error){
      if(mode==="auto" && localProvider){
        try { renderSearchResults(await window.deenAllahOmegaLocalSearch(q), "الفهرس المحلي بعد تعذر API"); return; } catch {}
      }
      throw error;
    }
  }catch(error){
    show("results",`<p class="error">تعذر تنفيذ البحث: ${escapeHtml(error.message)}</p>`);
  }finally{
    window.dispatchEvent(new CustomEvent("deenallah:search:end"));
  }
}
async function loadSources(category){
  if(getOmegaMode()==="offline_only" || navigator.onLine===false){show("results","<p class=\"error\">المصادر الحية تحتاج إلى اتصال. لم يتم إجراء طلب شبكة في الوضع الحالي.</p>");return;}
  show("results","<p>جارٍ تحميل المصادر…</p>");
  try{const data=await api(`/sources?category=${encodeURIComponent(category)}`);const sources=data.sources||[];show("results",`<h3>مصادر ${escapeHtml(category)}</h3><div class="result-grid">${sources.map(s=>`<article class="result"><b>${escapeHtml(s.nameAr||s.name||s.id)}</b><p>${escapeHtml(s.role||"مصدر")}</p>${s.url?`<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">فتح المصدر</a>`:""}</article>`).join("")}</div>`);}catch(error){show("results",`<p class="error">${escapeHtml(error.message)}</p>`);}
}
async function checkApi(){
  if(getOmegaMode()==="offline_only" || navigator.onLine===false){show("api-status","🟠 الوضع المحلي: لا يوجد فحص شبكة. المحتوى المحلي المحفوظ يبقى متاحًا.");return false;}
  if(!apiBase){show("api-status","⚠️ الواجهة جاهزة، لكن عنوان API لم يُضبط بعد. ضع عنوان الخدمة في إعدادات الربط أدناه.");return false;}
  try{const data=await api("/health");show("api-status",`🟢 API متصل — ${escapeHtml(data.name||"موسوعة دين الله")} — الإصدار ${escapeHtml(data.version||"")}`);return true;}catch(error){show("api-status",`🔴 تعذر الاتصال بالـAPI: ${escapeHtml(error.message)}`);return false;}
}
function saveApi(){const value=$("api-base").value.trim().replace(/\/$/,"");localStorage.setItem("deenAllahApiBase",value);location.search=value?`?api=${encodeURIComponent(value)}`:"";}
function installLearningHubLink(){const header=document.querySelector("header");if(!header||document.getElementById("learning-hub-link"))return;const a=document.createElement("a");a.id="learning-hub-link";a.href="./learning-hub.html";a.textContent="🎓 مركز التعلم التفاعلي — عبادات • قرآن • قبلة • مواقيت • زكاة";a.style.cssText="display:inline-block;margin-top:14px;padding:10px 16px;border-radius:999px;background:#fff;color:#0d4b36;text-decoration:none;font-weight:700";header.appendChild(a);}
window.deenAllahOmegaDeltaSync = omegaDeltaSync;
ensureConceptModal();installLearningHubLink();installMultimodalGuardBoundary();installVisualPrunerBoundary();installAudioSessionBoundary();installHardwareGuardianBoundary();installLocalStoreBoundary();installLocalProviderBoundary();installOfflineOmegaUI();registerOfflineAppShell();$("api-base").value=apiBase;$("search-btn").addEventListener("click",search);$("query").addEventListener("keydown",e=>{if(e.key==="Enter")search();});$("save-api").addEventListener("click",saveApi);$("api-check").addEventListener("click",checkApi);document.querySelectorAll("[data-category]").forEach(el=>el.addEventListener("click",()=>loadSources(el.dataset.category)));checkApi();
const quranRecitationScript=document.createElement("script");quranRecitationScript.src="./quran-recitation.js";quranRecitationScript.defer=true;document.head.appendChild(quranRecitationScript);
const voiceScript=document.createElement("script");voiceScript.src="./voice.js";voiceScript.defer=true;document.head.appendChild(voiceScript);
const bawabatVoiceScript=document.createElement("script");bawabatVoiceScript.src="./ya-bawabat-al-ilm.js";bawabatVoiceScript.defer=true;document.head.appendChild(bawabatVoiceScript);
