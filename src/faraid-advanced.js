import { SUPPORTED_MADHAHIB } from "./inheritance-calculator.js";

const MADHHAB_LABELS = {
  hanafi: "حنفي",
  maliki: "مالكي",
  shafii: "شافعي",
  hanbali: "حنبلي"
};

function scenario(name, notes, shares = {}) {
  return { name, notes, shares };
}

function requireMadhhab(madhhab) {
  if (!SUPPORTED_MADHAHIB.includes(madhhab)) {
    throw new Error(`Unsupported madhhab: ${madhhab}`);
  }
}

/**
 * Advanced faraid cases are intentionally conservative. Where classical jurists
 * differ or a legal determination is required, the engine returns scenarios and
 * a decision status instead of manufacturing a final inheritance share.
 */
export function analyzePregnancy({ madhhab = "hanbali", knownHeirs = {}, estate = 0 } = {}) {
  requireMadhhab(madhhab);
  if (!Number.isFinite(Number(estate)) || Number(estate) < 0) throw new Error("estate must be a non-negative number");
  return {
    case: "pregnancy",
    madhhab,
    madhhabLabelAr: MADHHAB_LABELS[madhhab],
    status: "scenario_only",
    rule: "يُوقف للحمل ما يلزم بحسب أقصى ما يمكن أن يستحقه، وتُعرض صور الذكورة والأنوثة وتعدد الحمل، ولا يعتمد التقسيم النهائي قبل تحقق حال الحمل أو الحكم المختص.",
    scenarios: [
      scenario("male", "فرض حمل واحد ذكراً مع بقاء بقية الورثة كما هي.", { fetus: "male" }),
      scenario("female", "فرض حمل واحد أنثى مع بقاء بقية الورثة كما هي.", { fetus: "female" }),
      scenario("multiple", "صورة احتياطية عند احتمال تعدد الحمل؛ تحتاج بيانات طبية/قضائية ولا تحسب آلياً كناتج نهائي.", { fetus: "multiple" })
    ],
    knownHeirs,
    estate: Number(estate),
    sources: ["quran-4-11", "ibn-qudamah-mughni", "shamela-faraid"],
    warning: "لا يجوز للمحرك اعتماد أحد السيناريوهات حكماً نهائياً قبل ثبوت حال الحمل؛ ويُعرض الاحتياط وفق القاعدة الفقهية المختارة."
  };
}

export function analyzeMissingPerson({ madhhab = "hanbali", knownHeirs = {}, estate = 0, legalStatus = "unknown" } = {}) {
  requireMadhhab(madhhab);
  const status = legalStatus === "deceased" ? "ready_for_distribution" : "hold_for_judicial_determination";
  return {
    case: "missing_person",
    madhhab,
    madhhabLabelAr: MADHHAB_LABELS[madhhab],
    status,
    rule: "المفقود لا يُعامل آلياً كميت لمجرد الغياب؛ يوقف ما يتوقف عليه الحكم حتى ثبوت الوفاة أو صدور الحكم المختص، ثم تعاد المسألة وفق تاريخ الوفاة والورثة.",
    legalStatus,
    knownHeirs,
    estate: Number(estate),
    sources: ["ibn-qudamah-mughni", "shamela-faraid"],
    warning: status === "hold_for_judicial_determination" ? "هذه حالة تحتاج حكماً قضائياً/شرعياً؛ لا يصدر المحرك قسمة نهائية." : null
  };
}

export function analyzeAmbiguousSex({ madhhab = "hanbali", knownHeirs = {}, estate = 0 } = {}) {
  requireMadhhab(madhhab);
  return {
    case: "ambiguous_sex",
    madhhab,
    madhhabLabelAr: MADHHAB_LABELS[madhhab],
    status: "scenario_only",
    rule: "في الخنثى المشكل تُعرض صور الاستحقاق المحتملة، ولا يختار النظام وصفاً جنسياً من تلقاء نفسه ولا يحسم الخلاف الفقهي دون قاعدة معتمدة.",
    scenarios: [
      scenario("male", "حصة الخنثى على تقدير الذكورة.", { heirSex: "male" }),
      scenario("female", "حصة الخنثى على تقدير الأنوثة.", { heirSex: "female" })
    ],
    knownHeirs,
    estate: Number(estate),
    sources: ["ibn-qudamah-mughni", "shamela-faraid"],
    warning: "النتيجة النهائية تتوقف على طريقة أهل الفرائض المعتمدة في المذهب وعلى وصف الحالة؛ لا تُعتمد النتيجة آلياً."
  };
}

export function analyzeMunasakhat({ madhhab = "hanbali", firstEstate = 0, firstHeirs = {}, secondDeceased = null } = {}) {
  requireMadhhab(madhhab);
  if (!Number.isFinite(Number(firstEstate)) || Number(firstEstate) < 0) throw new Error("firstEstate must be a non-negative number");
  if (!secondDeceased || !secondDeceased.id) {
    return {
      case: "munasakhat",
      madhhab,
      status: "input_required",
      rule: "المناسخة تحتاج ترتيب الوفيات، وتحديد من ورث الميت الأول، ثم انتقال نصيب الوارث الذي مات إلى ورثته.",
      required: ["first death date", "second death date", "first heirs", "second deceased heir", "second heirs"],
      firstEstate: Number(firstEstate),
      firstHeirs,
      sources: ["ibn-qudamah-mughni", "ibn-qayyim-ilam", "shamela-faraid"]
    };
  }
  return {
    case: "munasakhat",
    madhhab,
    status: "two_stage_required",
    rule: "تُحل المسألة الأولى أولاً، ثم يُنقل نصيب الوارث الذي مات إلى مسألته الخاصة، ثم تُصحح المسألتان وفق قواعد المناسخات.",
    firstEstate: Number(firstEstate),
    firstHeirs,
    secondDeceased,
    sources: ["ibn-qudamah-mughni", "shamela-faraid"],
    warning: "لا تُستخرج قسمة نهائية من هذا المسار إلا بعد إدخال ورثة الوفاة الثانية وتواريخ الوفاتين؛ ترتيب الوفيات مؤثر."
  };
}

export function analyzeAdvancedFaraid(input = {}) {
  switch (input.case) {
    case "pregnancy": return analyzePregnancy(input);
    case "missing_person": return analyzeMissingPerson(input);
    case "ambiguous_sex": return analyzeAmbiguousSex(input);
    case "munasakhat": return analyzeMunasakhat(input);
    default: throw new Error(`Unsupported advanced faraid case: ${input.case}`);
  }
}

export const ADVANCED_FARAID_CASES = [
  "pregnancy",
  "missing_person",
  "ambiguous_sex",
  "munasakhat"
];
