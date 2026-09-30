(() => {
  const MODE_KEY = "deenAllahOmegaMode";
  const MODES = Object.freeze(["auto", "offline_only", "online_only"]);
  const MODE_LABELS = Object.freeze({
    auto: "تلقائي",
    offline_only: "دون اتصال",
    online_only: "متصل"
  });

  const $ = id => document.getElementById(id);
  const mode = () => {
    const stored = localStorage.getItem(MODE_KEY);
    return MODES.includes(stored) ? stored : "auto";
  };

  function injectStyles() {
    if ($("omega-offline-ui-style")) return;
    const style = document.createElement("style");
    style.id = "omega-offline-ui-style";
    style.textContent = [
      "#omega-runtime-bar{position:sticky;top:0;z-index:1000;margin:0 auto;padding:8px 12px;max-width:1100px}",
      ".omega-runtime{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;background:#fff;border:1px solid #dbe8e0;border-radius:16px;box-shadow:0 8px 24px #17352a14;font:600 15px/1.35 system-ui,sans-serif}",
      ".omega-runtime [data-omega-state]{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;background:#e9f4ee;color:#0d4b36}",
      ".omega-runtime .omega-spacer{flex:1}",
      ".omega-runtime button{border:1px solid #dbe8e0;border-radius:999px;background:#fff;color:#17352a;padding:6px 10px;cursor:pointer}",
      ".omega-runtime button[aria-pressed=true]{background:#176b4b;color:#fff;border-color:#176b4b}",
      ".omega-runtime button:focus-visible,#omega-quick-search:focus-visible{outline:3px solid #a87918;outline-offset:2px}",
      ".omega-progress{height:3px;margin-top:7px;overflow:hidden;border-radius:999px;background:#e9f4ee}",
      ".omega-progress>span{display:block;width:35%;height:100%;transform:translateX(-140%);background:#176b4b;animation:omega-progress 1.1s linear infinite}",
      ".omega-progress[hidden]{display:none}",
      "#omega-quick-search{position:fixed;bottom:18px;left:18px;z-index:1100;border:0;border-radius:999px;background:#0d4b36;color:#fff;padding:11px 15px;font:700 15px system-ui,sans-serif;box-shadow:0 12px 30px #0003;cursor:pointer}",
      ".omega-skeleton{min-height:110px;border-radius:15px;background:linear-gradient(90deg,#f4f8f6 25%,#e9f4ee 37%,#f4f8f6 63%);background-size:400% 100%;animation:omega-shimmer 1.15s ease infinite}",
      ".omega-toast{position:fixed;right:18px;bottom:18px;z-index:1200;max-width:min(420px,calc(100vw - 36px));padding:11px 14px;border-radius:14px;background:#17352a;color:#fff;box-shadow:0 14px 34px #0004;font:600 14px/1.5 system-ui,sans-serif}",
      "@keyframes omega-shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}",
      "@keyframes omega-progress{to{transform:translateX(300%)}}",
      "@media(prefers-reduced-motion:reduce){.omega-skeleton,.omega-progress>span{animation:none}.omega-skeleton{background:#f4f8f6}}",
      "@media(max-width:600px){#omega-runtime-bar{padding:6px 8px}.omega-runtime{font-size:14px}.omega-runtime .omega-spacer{display:none}#omega-quick-search{bottom:12px;left:12px}}"
    ].join("");
    document.head.appendChild(style);
  }

  function toast(message) {
    document.querySelector(".omega-toast")?.remove();
    const el = document.createElement("div");
    el.className = "omega-toast";
    el.setAttribute("role", "status");
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function ensureBar() {
    injectStyles();
    let host = $("omega-runtime-bar");
    if (!host) {
      host = document.createElement("div");
      host.id = "omega-runtime-bar";
      document.body.insertBefore(host, document.body.firstChild);
    }
    host.innerHTML = [
      '<div class="omega-runtime" role="status" aria-live="polite">',
      '<span data-omega-state>🟢 <span data-omega-network>متصل</span></span>',
      "<span>Ω</span>",
      '<span>وضع: <b data-omega-mode-label>تلقائي</b></span>',
      '<span class="omega-spacer"></span>',
      '<button type="button" data-omega-mode="auto" aria-pressed="false">تلقائي</button>',
      '<button type="button" data-omega-mode="offline_only" aria-pressed="false">دون اتصال</button>',
      '<button type="button" data-omega-mode="online_only" aria-pressed="false">متصل</button>',
      '<span data-omega-storage class="muted"></span>',
      "</div>",
      '<div class="omega-progress" data-omega-progress hidden><span></span></div>'
    ].join("");

    host.querySelectorAll("[data-omega-mode]").forEach(button => {
      button.addEventListener("click", () => {
        const next = button.dataset.omegaMode;
        localStorage.setItem(MODE_KEY, next);
        render();
        toast("تم تغيير وضع Ω إلى: " + MODE_LABELS[next]);
      });
    });
  }

  function render() {
    const current = mode();
    document.querySelectorAll("[data-omega-mode]").forEach(button => {
      button.setAttribute("aria-pressed", button.dataset.omegaMode === current ? "true" : "false");
    });
    const label = document.querySelector("[data-omega-mode-label]");
    if (label) label.textContent = MODE_LABELS[current];

    const online = navigator.onLine !== false;
    const state = document.querySelector("[data-omega-state]");
    const network = document.querySelector("[data-omega-network]");
    if (state) state.firstChild.textContent = online ? "🟢 " : "🟠 ";
    if (network) network.textContent = online ? "متصل" : "غير متصل";

    $("query")?.setAttribute("data-omega-mode", current);
    $("search-btn")?.setAttribute("data-omega-mode", current);
  }

  async function renderStorage() {
    const target = document.querySelector("[data-omega-storage]");
    if (!target || !navigator.storage?.estimate) return;
    try {
      const result = await navigator.storage.estimate();
      const usage = Number(result.usage || 0);
      const quota = Number(result.quota || 0);
      const mb = value => Math.round(value / 1024 / 1024);
      target.textContent = quota ? "التخزين: " + mb(usage) + "/" + mb(quota) + " MB" : "";
    } catch {}
  }

  function setBusy(busy) {
    const progress = document.querySelector("[data-omega-progress]");
    const results = $("results");
    const searchButton = $("search-btn");
    if (progress) progress.hidden = !busy;
    if (results) results.setAttribute("aria-busy", busy ? "true" : "false");
    if (searchButton) searchButton.disabled = busy;
    if (busy && results) {
      results.innerHTML = '<div class="omega-skeleton" aria-label="جارٍ تجهيز النتائج" role="status"></div>';
    }
  }

  function installQuickSearch() {
    if ($("omega-quick-search")) return;
    const button = document.createElement("button");
    button.id = "omega-quick-search";
    button.type = "button";
    button.textContent = "⌕ بحث سريع";
    button.addEventListener("click", () => $("query")?.focus());
    document.body.appendChild(button);
  }

  function installKeyboardShortcut() {
    document.addEventListener("keydown", event => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      event.preventDefault();
      $("query")?.focus();
    });
  }

  window.addEventListener("online", () => {
    render();
    toast("عاد الاتصال بالإنترنت؛ وضع Ω لا يغيّر وحده اختيارك.");
  });

  window.addEventListener("offline", () => {
    render();
    toast("أنت الآن دون اتصال؛ لن ندّعي نجاح بحث عالمي دون شبكة.");
  });

  window.addEventListener("deenallah:search:start", () => setBusy(true));
  window.addEventListener("deenallah:search:end", () => {
    setBusy(false);
    renderStorage();
  });

  ensureBar();
  installQuickSearch();
  installKeyboardShortcut();
  render();
  renderStorage();

  window.deenAllahOfflineUI = Object.freeze({
    getMode: mode,
    setMode(next) {
      if (!MODES.includes(next)) throw new TypeError("unsupported mode: " + next);
      localStorage.setItem(MODE_KEY, next);
      render();
    },
    setBusy,
    getNetworkState: () => navigator.onLine !== false
  });
})();
