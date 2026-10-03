(() => {
  "use strict";

  const DRIVER_URL = "https://cdn.jsdelivr.net/npm/driver.js@1.4.0/dist/driver.js.iife.js";
  const DRIVER_CSS = "https://cdn.jsdelivr.net/npm/driver.js@1.4.0/dist/driver.css";
  const LUCIDE_URL = "https://cdn.jsdelivr.net/npm/lucide@0.534.0/dist/umd/lucide.min.js";
  const state = { driverPromise: null, lucidePromise: null };

  const $ = (selector, root = document) => root.querySelector(selector);

  function addRemoteStyleOnce(href, key) {
    if (document.querySelector('link[data-third-party="' + key + '"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.crossOrigin = "anonymous";
    link.dataset.thirdParty = key;
    document.head.appendChild(link);
  }

  function loadScriptOnce(src, key) {
    const existing = document.querySelector('script[data-third-party="' + key + '"]');
    if (existing) {
      return Promise.resolve();
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.thirdParty = key;
    const promise = new Promise((resolve, reject) => {
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => reject(new Error("third-party script unavailable")), { once: true });
    });
    document.head.appendChild(script);
    return promise;
  }

  function loadLucide() {
    if (window.lucide?.createIcons) return Promise.resolve(window.lucide);
    if (!state.lucidePromise) {
      state.lucidePromise = loadScriptOnce(LUCIDE_URL, "lucide-0.534.0")
        .then(() => {
          if (!window.lucide?.createIcons) throw new Error("Lucide API unavailable");
          return window.lucide;
        });
    }
    return state.lucidePromise;
  }

  function decorateIcons() {
    loadLucide().then((lucide) => {
      lucide.createIcons({ attrs: { "stroke-width": 2 } });
    }).catch(() => {
      // Existing text/emoji labels remain the offline-safe fallback.
    });
  }

  const steps = [
    { element: "[data-tour='search']", popover: { title: "البحث العالمي", description: "ابدأ من هنا للبحث متعدد اللغات مع إبقاء المصدر والنص الأصلي والترجمة منفصلة.", side: "bottom" } },
    { element: "[data-tour='library']", popover: { title: "مجاالت الموسوعة", description: "انتقل إلى القرآن والحديث والسيرة والفقه والكتب ومصادر التعلم.", side: "top" } },
    { element: "[data-tour='learning']", popover: { title: "اختبر نفسك", description: "التعلم منفصل عن الفتوى، وكل سؤال يحمل مصدره ومنهجيته.", side: "top" } },
    { element: "[data-tour='voice']", popover: { title: "الصوت والتجويد", description: "الصوت والمعالجة المحلية جزء من طبقة الهُدى، مع عدم الادعاء بتقييم التجويد دون محرك موثوق.", side: "top" } },
    { element: "[data-tour='pdf']", popover: { title: "الكتب وPDF", description: "الملفات الحقيقية تُعرض للتنزيل العام فقط عندما تسمح الحقوق بذلك.", side: "top" } }
  ];

  function availableSteps() {
    return steps.filter((step) => document.querySelector(step.element));
  }

  function openNativeFallback() {
    const list = availableSteps();
    if (!list.length) return;

    let index = 0;
    const backdrop = document.createElement("div");
    backdrop.className = "native-tour-backdrop";
    const card = document.createElement("section");
    card.className = "native-tour-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");

    const render = () => {
      const current = list[index];
      const title = current.popover.title;
      const description = current.popover.description;
      card.innerHTML = `
        <h3>${title}</h3>
        <p>${description}</p>
        <p class="muted">خطوة ${index + 1} من ${list.length}</p>
        <div class="native-tour-actions">
          <button class="native-tour-secondary" data-tour-close>إغلاق</button>
          <div>
            ${index > 0 ? '<button class="native-tour-secondary" data-tour-prev>السابق</button>' : ''}
            ${index < list.length - 1 ? '<button class="native-tour-primary" data-tour-next>التالي</button>' : '<button class="native-tour-primary" data-tour-done>تم</button>'}
          </div>
        </div>`;
      document.querySelector(current.element)?.scrollIntoView({ behavior: "smooth", block: "center" });
      card.querySelector("[data-tour-close]")?.addEventListener("click", close);
      card.querySelector("[data-tour-prev]")?.addEventListener("click", () => { index -= 1; render(); });
      card.querySelector("[data-tour-next]")?.addEventListener("click", () => { index += 1; render(); });
      card.querySelector("[data-tour-done]")?.addEventListener("click", close);
    };

    const close = () => {
      backdrop.remove();
      card.remove();
      localStorage.setItem("deenAllahTourCompleted", "1");
    };

    backdrop.addEventListener("click", close);
    document.body.append(backdrop, card);
    render();
  }

  function loadDriver() {
    if (window.driver?.js?.driver) return Promise.resolve(window.driver.js.driver);
    if (!state.driverPromise) {
      addRemoteStyleOnce(DRIVER_CSS, "driverjs-1.4.0-css");
      state.driverPromise = loadScriptOnce(DRIVER_URL, "driverjs-1.4.0")
        .then(() => {
          if (!window.driver?.js?.driver) throw new Error("Driver.js API unavailable");
          return window.driver.js.driver;
        });
    }
    return state.driverPromise;
  }

  function startTour() {
    const list = availableSteps();
    if (!list.length) return;
    loadDriver().then((driver) => {
      const controller = driver({
        showProgress: true,
        animate: true,
        smoothScroll: true,
        allowClose: true,
        overlayColor: "rgba(15,35,29,.64)",
        nextBtnText: "التالي",
        prevBtnText: "السابق",
        doneBtnText: "تم",
        onDestroyed: () => localStorage.setItem("deenAllahTourCompleted", "1")
      });
      controller.setSteps(list);
      controller.drive();
    }).catch(() => openNativeFallback());
  }

  function installTourButton() {
    const header = $("header");
    if (!header || $("#deen-tour-launch")) return;
    const button = document.createElement("button");
    button.id = "deen-tour-launch";
    button.className = "ui-tour-launch";
    button.type = "button";
    button.setAttribute("aria-label", "ابدأ جولة الهُدى في الموسوعة");
    button.innerHTML = '<i data-lucide="compass" class="ui-icon" aria-hidden="true"></i><span>جولة الهُدى</span>';
    button.addEventListener("click", startTour);
    header.appendChild(button);
  }

  function markTourTargets() {
    $("#query")?.closest(".card")?.setAttribute("data-tour", "search");
    $("#library")?.setAttribute("data-tour", "library");
    $('a[href="./self-test.html"]')?.closest(".hero-links")?.closest(".card")?.setAttribute("data-tour", "learning");
    document.querySelector('header + main section:nth-of-type(4)')?.setAttribute("data-tour", "voice");
    $("#pdf")?.setAttribute("data-tour", "pdf");
  }

  function addSafetyNote() {
    if ($("#ui-third-party-note")) return;
    const note = document.createElement("p");
    note.id = "ui-third-party-note";
    note.className = "muted";
    note.style.cssText = "text-align:center;font-size:13px;margin:10px 0 0";
    note.textContent = "تحسينات الواجهة اختيارية: تعمل محليًا مع fallback عند تعذر الشبكة.";
    document.querySelector("footer")?.before(note);
  }

  function init() {
    markTourTargets();
    installTourButton();
    addSafetyNote();
    decorateIcons();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
