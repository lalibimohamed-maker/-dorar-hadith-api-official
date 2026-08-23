(() => {
  const STORAGE = "deenAllahVoiceProfiles";
  const DEFAULTS = { rate: 1, pitch: 1, volume: 1, gender: "any", voiceURI: "", autoSpeak: false };
  const QuranDomains = new Set(["quran", "quran-ayah", "quran-verse", "recitation"]);
  const $ = id => document.getElementById(id);
  const baseLang = () => (navigator.language || "ar").toLowerCase();
  const langKey = lang => String(lang || baseLang()).toLowerCase();
  const readProfiles = () => { try { return JSON.parse(localStorage.getItem(STORAGE) || "{}"); } catch { return {}; } };
  const writeProfiles = p => localStorage.setItem(STORAGE, JSON.stringify(p));
  const profileFor = lang => ({ ...DEFAULTS, ...(readProfiles()[langKey(lang)] || {}) });
  const saveProfile = (lang, patch) => { const p = readProfiles(); const k = langKey(lang); p[k] = { ...DEFAULTS, ...(p[k] || {}), ...patch }; writeProfiles(p); };

  function voices() { return window.speechSynthesis ? window.speechSynthesis.getVoices() : []; }
  function languageVoices(lang) {
    const l = langKey(lang); const short = l.split("-")[0];
    return voices().filter(v => { const vl = String(v.lang || "").toLowerCase(); return vl === l || vl.startsWith(short + "-") || vl === short; });
  }
  function guessGender(v) {
    const n = String(v?.name || "").toLowerCase();
    if (/female|woman|girl|zira|samantha|ava|victoria|karen|moira|fiona|susan|sara|amelie|audrey|anna|monica/.test(n)) return "female";
    if (/male|man|boy|daniel|alex|fred|thomas|oliver|arthur|jorge|diego|luca/.test(n)) return "male";
    return "unknown";
  }
  function selectVoice(lang) {
    const p = profileFor(lang); const list = languageVoices(lang);
    if (p.voiceURI) { const exact = list.find(v => v.voiceURI === p.voiceURI); if (exact) return exact; }
    if (p.gender !== "any") { const gender = list.find(v => guessGender(v) === p.gender); if (gender) return gender; }
    return list.find(v => v.default) || list[0] || null;
  }

  function speak(text, lang = baseLang(), meta = {}) {
    if (!text || !window.speechSynthesis) return false;
    const domain = String(meta.domain || meta.category || "").toLowerCase();
    if (QuranDomains.has(domain)) {
      announce("القرآن له مسار تلاوة مستقل؛ لن تستخدم الموسوعة صوتًا توليديًا لقراءة الآية.");
      return false;
    }
    window.speechSynthesis.cancel();
    const p = profileFor(lang); const u = new SpeechSynthesisUtterance(String(text));
    u.lang = langKey(lang); u.rate = Number(p.rate) || 1; u.pitch = Number(p.pitch) || 1; u.volume = Number(p.volume) || 1;
    const v = selectVoice(lang); if (v) { u.voice = v; u.lang = v.lang || u.lang; }
    window.speechSynthesis.speak(u); return true;
  }

  function announce(text) {
    let el = $("voice-status"); if (!el) { el = document.createElement("div"); el.id = "voice-status"; el.className = "voice-status"; document.body.appendChild(el); }
    el.textContent = text; clearTimeout(el._timer); el._timer = setTimeout(() => { el.textContent = ""; }, 5000);
  }

  function injectStyles() {
    if ($("deen-voice-style")) return;
    const s = document.createElement("style"); s.id = "deen-voice-style"; s.textContent = `
      .voice-controls{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center}.voice-btn{border:1px solid var(--line);background:#e9f4ee;color:var(--gd);border-radius:12px;padding:9px 13px;font:inherit;cursor:pointer}.voice-btn.recording{background:#ffe8e5;color:#8a2119}.voice-settings{margin-top:14px;border:1px solid var(--line);border-radius:16px;padding:14px;background:#f7fbf8}.voice-settings summary{cursor:pointer;font-weight:700}.voice-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-top:10px}.voice-grid label{display:flex;flex-direction:column;gap:5px;font-size:15px}.voice-grid select,.voice-grid input{border:1px solid var(--line);border-radius:10px;padding:8px;background:#fff;font:inherit}.voice-status{position:fixed;z-index:10000;bottom:18px;right:18px;left:18px;max-width:720px;margin:auto;padding:10px 14px;border-radius:12px;background:#0d4b36;color:#fff;text-align:center;box-shadow:0 8px 30px #0003}.voice-status:empty{display:none}.result .result-voice{float:left;margin-inline-start:8px}.voice-note{font-size:14px;color:var(--muted);margin-top:8px}`; document.head.appendChild(s);
  }

  function buildSettings() {
    const host = $("api-base")?.closest("section"); if (!host || $("voice-settings")) return;
    const box = document.createElement("section"); box.className = "voice-settings"; box.id = "voice-settings";
    box.innerHTML = `<details><summary>🎙️ إعدادات الصوت واللغات</summary><p class="muted">إعدادات مستقلة لكل لغة: اختيار صوت من الأصوات التي يوفرها الجهاز/المتصفح، تفضيل رجل/امرأة/تلقائي، السرعة والنبرة ومستوى الصوت. لا تُستخدم هذه الطبقة لتلاوة القرآن.</p><div class="voice-grid"><label>اللغة<select id="voice-lang"><option value="ar">العربية</option><option value="en">English</option><option value="fr">Français</option><option value="es">Español</option><option value="de">Deutsch</option><option value="tr">Türkçe</option><option value="ur">اردو</option><option value="id">Bahasa Indonesia</option><option value="ms">Bahasa Melayu</option><option value="bn">বাংলা</option><option value="hi">हिन्दी</option><option value="fa">فارسی</option><option value="pt">Português</option><option value="it">Italiano</option><option value="ru">Русский</option><option value="zh">中文</option><option value="ja">日本語</option><option value="ko">한국어</option></select></label><label>الصوت<select id="voice-choice"></select></label><label>التفضيل<select id="voice-gender"><option value="any">تلقائي / أي صوت</option><option value="female">امرأة</option><option value="male">رجل</option></select></label><label>السرعة<input id="voice-rate" type="range" min="0.6" max="1.4" step="0.05"></label><label>النبرة<input id="voice-pitch" type="range" min="0.7" max="1.3" step="0.05"></label><label>مستوى الصوت<input id="voice-volume" type="range" min="0.2" max="1" step="0.05"></label></div><div class="voice-controls"><button class="voice-btn" id="voice-test">🔊 اختبار الصوت</button><button class="voice-btn" id="voice-save">حفظ لغة الصوت</button></div><p class="voice-note">قد لا يعرّف النظام جنس بعض الأصوات؛ عندها يبقى الاختيار تلقائيًا. عدد الأصوات المتاحة يختلف حسب الجهاز واللغة، ويمكن أن تكون أصوات Apple/Siri أو أصوات النظام متاحة للمتصفح بحسب صلاحيات النظام.</p></details>`;
    host.parentNode.insertBefore(box, host.nextSibling);
    const lang = $("voice-lang"), choice = $("voice-choice"), gender = $("voice-gender"), rate = $("voice-rate"), pitch = $("voice-pitch"), volume = $("voice-volume");
    const refresh = () => { const l = lang.value; const p = profileFor(l); gender.value = p.gender; rate.value = p.rate; pitch.value = p.pitch; volume.value = p.volume; const list = languageVoices(l); choice.innerHTML = list.length ? list.map(v => `<option value="${escapeAttr(v.voiceURI)}">${escapeHtml(v.name)} — ${escapeHtml(v.lang)}${v.default ? " — افتراضي" : ""}</option>`).join("") : `<option value="">لا توجد أصوات متاحة حاليًا لهذه اللغة</option>`; if (p.voiceURI && list.some(v => v.voiceURI === p.voiceURI)) choice.value = p.voiceURI; };
    lang.addEventListener("change", refresh); $("voice-save").addEventListener("click", () => { saveProfile(lang.value, { voiceURI: choice.value, gender: gender.value, rate: Number(rate.value), pitch: Number(pitch.value), volume: Number(volume.value) }); announce("تم حفظ إعدادات الصوت لهذه اللغة."); }); $("voice-test").addEventListener("click", () => { speak(lang.value === "ar" ? "مرحبًا بكم في موسوعة دين الله." : "Welcome to Deen Allah Encyclopedia.", lang.value); });
    refresh(); if (window.speechSynthesis) window.speechSynthesis.addEventListener("voiceschanged", refresh);
  }

  function escapeHtml(v) { return String(v ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
  function escapeAttr(v) { return escapeHtml(v).replace(/`/g, "&#96;"); }

  function setupMicrophone() {
    const input = $("query"), searchButton = $("search-btn"); if (!input || !searchButton || $("voice-mic")) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const wrap = searchButton.parentElement; const mic = document.createElement("button"); mic.id="voice-mic"; mic.className="btn secondary"; mic.type="button"; mic.textContent="🎙️ تحدث"; mic.title="التحدث بلغتك إلى الموسوعة"; wrap.appendChild(mic);
    if (!SpeechRecognition) { mic.disabled = true; mic.title = "التعرف على الكلام غير متاح في هذا المتصفح"; return; }
    let recognition; let listening = false;
    mic.addEventListener("click", () => {
      if (listening) { recognition?.stop(); return; }
      recognition = new SpeechRecognition(); recognition.lang = baseLang(); recognition.interimResults = true; recognition.continuous = false;
      recognition.onstart = () => { listening = true; mic.classList.add("recording"); mic.textContent="⏹️ إيقاف"; announce(`تستمع الموسوعة الآن باللغة ${recognition.lang}.`); };
      recognition.onresult = e => { const text = Array.from(e.results).map(r => r[0].transcript).join(" "); input.value = text; if (e.results[e.results.length-1].isFinal) searchButton.click(); };
      recognition.onerror = e => announce(`تعذر التقاط الصوت: ${e.error}`);
      recognition.onend = () => { listening=false; mic.classList.remove("recording"); mic.textContent="🎙️ تحدث"; };
      try { recognition.start(); } catch (e) { announce("تعذر تشغيل الميكروفون. تحقق من إذن المتصفح."); }
    });
  }

  function expose() { window.DeenAllahVoice = { speak, profileFor, saveProfile, languageVoices, selectVoice, isQuranDomain: d => QuranDomains.has(String(d || "").toLowerCase()) }; }
  function init() { injectStyles(); buildSettings(); setupMicrophone(); expose(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
