import {
  analyzePregnancy,
  analyzeMissingPerson,
  analyzeAmbiguousSex,
  analyzeMunasakhat
} from "./faraid-advanced.js";

export const COMPLEX_FARAID_CASES = [
  {
    id: "grandfather-with-siblings",
    titleAr: "الجد مع الإخوة",
    status: "requires-madhhab-rule",
    topics: ["الجد", "الإخوة", "الحجب", "التعصيب"],
    descriptionAr: "مسائل الجد مع الإخوة من أبواب الخلاف والتفصيل في كتب الفرائض، فلا تُحسب بقاعدة عامة واحدة.",
    safeAction: "require_specialized_rule",
    sources: ["المغني", "بدائع الصنائع", "الشرح الكبير", "المجموع", "المكتبة الشاملة — قسم الفرائض والوصايا"]
  },
  {
    id: "munasakhat",
    titleAr: "المناسخات وتعدد الوفيات",
    status: "requires_case_chain",
    topics: ["مناسخات", "تعدد الوفيات", "انتقال التركة"],
    descriptionAr: "إذا مات وارث قبل قسمة التركة، يجب بناء مسألة مستقلة لكل وفاة وربط الأنصبة المتتابعة.",
    safeAction: "require_death_chain",
    sources: ["المغني", "إعلام الموقعين", "كتب الفرائض في المكتبة الشاملة"]
  },
  {
    id: "pregnancy",
    titleAr: "الحمل",
    status: "requires-scenario-analysis",
    topics: ["حمل", "تقدير الجنين", "وقف نصيب"],
    descriptionAr: "ميراث الحمل يتطلب تقدير أحوال الجنين وتأجيل القسمة أو حفظ القدر المتيقن وفق القاعدة المعتمدة.",
    safeAction: "reserve-and-recalculate-after-birth",
    sources: ["كتب الفرائض والوصايا", "المكتبة الشاملة — قسم الفرائض والوصايا"]
  },
  {
    id: "missing-person",
    titleAr: "المفقود",
    status: "requires-judicial-determination",
    topics: ["مفقود", "استصحاب الحياة", "حكم قضائي"],
    descriptionAr: "ميراث المفقود يتأثر بثبوت حياته أو وفاته والحكم القضائي ووقت الحكم، فلا يُحسم آلياً من بيانات الورثة فقط.",
    safeAction: "require-judicial-review",
    sources: ["كتب الفرائض", "فتاوى أهل السنة الموثقة"]
  },
  {
    id: "khuntha",
    titleAr: "الخنثى المشكل",
    status: "requires-specialized-rule",
    topics: ["خنثى", "تقدير النصيب", "اختلاف الفقهاء"],
    descriptionAr: "تقدير نصيب الخنثى المشكل من المسائل الدقيقة التي يلزم فيها تطبيق القاعدة الفقهية المعتمدة وعدم التخمين.",
    safeAction: "require-specialized-rule",
    sources: ["كتب الفرائض", "فتاوى أهل السنة الموثقة"]
  },
  {
    id: "multiple-spouses",
    titleAr: "تعدد الزوجات",
    status: "supported-with-share-splitting",
    topics: ["زوجات", "فرض الزوجات"],
    descriptionAr: "إذا تعددت الزوجات اشتركن في الفرض المقرر لهن بحسب وجود الفرع الوارث.",
    safeAction: "split-fixed-share-equally"
  },
  {
    id: "awl",
    titleAr: "العَول",
    status: "supported-common-cases",
    topics: ["عول", "أصل المسألة"],
    descriptionAr: "إذا زادت الفروض على أصل المسألة يُعالج العول بالنسبة المشتركة، مع توثيق أصل المسألة.",
    safeAction: "apply-awl"
  },
  {
    id: "radd",
    titleAr: "الرَّد",
    status: "madhhab-sensitive",
    topics: ["رد", "الفاضل", "بيت المال"],
    descriptionAr: "الرد من المسائل التي تختلف تفاصيلها، خصوصاً في حكم الزوجين، ولذلك يجب إظهار السياق المذهبي وعدم إخفاء الخلاف.",
    safeAction: "apply-only-when-rule-is-explicit"
  },
  {
    id: "correction",
    titleAr: "تصحيح المسألة",
    status: "supported",
    topics: ["تصحيح", "رؤوس العصبة", "المقامات"],
    descriptionAr: "تحويل الأنصبة إلى أصل قابل للقسمة على رؤوس العصبة عند الحاجة.",
    safeAction: "calculate-common-denominator-and-correction"
  }
];

export function listComplexFaraidCases({ status, topic } = {}) {
  return COMPLEX_FARAID_CASES.filter((item) =>
    (!status || item.status === status) &&
    (!topic || item.topics.includes(topic))
  );
}

export function getComplexFaraidCase(id) {
  return COMPLEX_FARAID_CASES.find((item) => item.id === id) || null;
}

export function analyzeComplexFaraidCase(id, input = {}) {
  switch (id) {
    case "pregnancy": return analyzePregnancy(input);
    case "missing-person": return analyzeMissingPerson(input);
    case "khuntha": return analyzeAmbiguousSex(input);
    case "munasakhat": return analyzeMunasakhat(input);
    default: return null;
  }
}
