const STUDIO_STEPS = {
  wudu: [
    ["النية", "استحضر نية الطهارة في القلب."],
    ["غسل الكفين", "اغسل كفيك ثم تابع بقية الوضوء وفق الصفة الموثقة."],
    ["المضمضة والاستنشاق", "طبّق المضمضة والاستنشاق كما في الدليل المعروض في درس الوضوء."],
    ["غسل الوجه", "اغسل الوجه كاملًا من حد الشعر المعتاد إلى الذقن ومن الأذن إلى الأذن."],
    ["غسل اليدين", "اغسل اليد اليمنى ثم اليسرى إلى المرفقين."],
    ["مسح الرأس والأذنين", "امسح الرأس والأذنين على الصفة الموثقة في الدرس."],
    ["غسل الرجلين", "اغسل الرجلين إلى الكعبين مع إيصال الماء إلى المواضع المطلوبة."]
  ],
  prayer: [
    ["القيام والاستعداد", "استقبل القبلة واستحضر الصلاة والنية في القلب."],
    ["تكبيرة الإحرام", "ارفع يديك على الصفة الموثقة وقل: الله أكبر."],
    ["القراءة", "اقرأ الفاتحة وما تيسر، مع تطبيق أحكام التجويد التي يعرضها درس القراءة."],
    ["الركوع", "كبّر واركع مطمئنًا، وطبّق الذكر الوارد في الدرس."],
    ["الرفع من الركوع", "ارفع حتى تستوي قائمًا وتحقق الطمأنينة."],
    ["السجود", "كبّر واسجد على الأعضاء المعلومة مع الطمأنينة والذكر الوارد."],
    ["الجلوس بين السجدتين", "اجلس مطمئنًا وقل الذكر الثابت في الدرس."],
    ["التشهد والسلام", "أتم التشهد والصلاة على النبي ﷺ ثم سلّم على الصفة الموثقة."]
  ],
  janazah: [
    ["تجهيز الميت", "اعرض درس الغسل والتكفين قبل بدء صلاة الجنازة."],
    ["التكبيرة الأولى", "كبّر واقرأ الفاتحة وفق الدليل المعتمد في الدرس."],
    ["التكبيرة الثانية", "صل على النبي ﷺ بالصلاة الثابتة."],
    ["التكبيرة الثالثة", "ادع للميت بالأدعية الثابتة."],
    ["التكبيرة الرابعة", "أتم الدعاء ثم سلّم وفق الصفة المعتمدة."]
  ],
  adhan: [
    ["الأذان", "استمع إلى اللفظ الصحيح ثم كرر مع المؤذن."],
    ["المتابعة", "تعلّم مواضع قول الحيعلتين: لا حول ولا قوة إلا بالله."],
    ["بعد الأذان", "تعلّم الصلاة على النبي ﷺ والدعاء الوارد بعد الأذان."]
  ]
};

const MODULE_LABELS = { wudu: "الوضوء", prayer: "الصلاة", janazah: "صلاة الجنازة", adhan: "الأذان" };
let current = { module: "wudu", index: 0, score: 0 };

function studioRoot() { return document.getElementById("worship-studio"); }
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = document.documentElement.lang === "ar" ? "ar-SA" : (navigator.language || "ar-SA");
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}
function renderStudio() {
  const root = studioRoot();
  if (!root) return;
  const steps = STUDIO_STEPS[current.module] || STUDIO_STEPS.wudu;
  const step = steps[current.index] || steps[0];
  root.innerHTML = `<div class="studio-head"><div><b>${MODULE_LABELS[current.module]}</b><span> خطوة ${current.index + 1} من ${steps.length}</span></div><div class="studio-actions"><button data-action="speak">🔊 استمع</button><button data-action="next">التالي</button></div></div><div class="studio-progress"><i style="width:${((current.index + 1) / steps.length) * 100}%"></i></div><article class="studio-step"><div class="studio-illustration" aria-hidden="true">${current.module === "prayer" ? "🧎" : current.module === "adhan" ? "🕌" : current.module === "janazah" ? "🤲" : "💧"}</div><h3>${step[0]}</h3><p>${step[1]}</p><p class="studio-evidence">الدليل التفصيلي يُعرض من طبقة المصادر قبل اعتماد الخطوة التعليمية.</p><button data-action="practice">✅ طبّقت الخطوة</button></article><div class="studio-modules">${Object.entries(MODULE_LABELS).map(([id,label]) => `<button data-module="${id}" class="${id === current.module ? "active" : ""}">${label}</button>`).join("")}</div>`;
}

function bindStudio() {
  const root = studioRoot();
  if (!root || root.dataset.bound) return;
  root.dataset.bound = "1";
  root.addEventListener("click", (e) => {
    const module = e.target.closest("[data-module]")?.dataset.module;
    if (module) { current = { module, index: 0, score: 0 }; renderStudio(); return; }
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "speak") { const step = (STUDIO_STEPS[current.module] || [])[current.index]; if (step) speak(`${step[0]}. ${step[1]}`); }
    if (action === "practice") { current.score += 1; e.target.textContent = "✓ أحسنت، سجّل تقدمك"; }
    if (action === "next") { const steps = STUDIO_STEPS[current.module] || []; current.index = Math.min(current.index + 1, steps.length - 1); renderStudio(); }
  });
  renderStudio();
}

function calculateZakat() {
  const cash = Number(document.getElementById("z-cash")?.value || 0);
  const gold = Number(document.getElementById("z-gold")?.value || 0);
  const silver = Number(document.getElementById("z-silver")?.value || 0);
  const trade = Number(document.getElementById("z-trade")?.value || 0);
  const debts = Number(document.getElementById("z-debts")?.value || 0);
  const nisab = Number(document.getElementById("z-nisab")?.value || 0);
  const net = Math.max(cash + gold + silver + trade - debts, 0);
  const due = nisab > 0 && net >= nisab ? net * 0.025 : 0;
  const out = document.getElementById("z-result");
  if (out) out.textContent = nisab > 0 ? `المال المحتسب: ${net.toFixed(2)} — الزكاة التقريبية: ${due.toFixed(2)}. هذه نتيجة تعليمية ولا تُغني عن تطبيق أحكام نوع المال والحول والنصاب عند أهل العلم.` : `المال المحتسب: ${net.toFixed(2)}. أدخل النصاب المعتمد لنوع المال لإكمال الحساب.`;
}

function initZakat() {
  const root = document.getElementById("zakat-studio");
  if (!root || root.dataset.bound) return;
  root.dataset.bound = "1";
  root.querySelectorAll("input").forEach((input) => input.addEventListener("input", calculateZakat));
  calculateZakat();
}

document.addEventListener("DOMContentLoaded", () => { bindStudio(); initZakat(); });
