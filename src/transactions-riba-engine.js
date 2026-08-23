const SOURCES = {
  quranRiba: { kind: "quran", references: ["2:275-279", "3:130", "4:29"], verification: "canonical-scripture-reference" },
  quranWealth: { kind: "quran", references: ["2:188", "4:2", "4:10", "4:29", "83:1-3"], verification: "canonical-scripture-reference" },
  quranGambling: { kind: "quran", references: ["5:90-91"], verification: "canonical-scripture-reference" },
  muslimGold: { kind: "hadith", book: "صحيح مسلم", reference: "1587", narrator: "عبادة بن الصامت", grade: "صحيح", url: "https://dorar.net/h/RKo8mdTr", note: "أصل باب الربا في مبادلة الأصناف الربوية والصرف" },
  abuDawudGold: { kind: "hadith", book: "سنن أبي داود", reference: "3349", narrator: "عبادة بن الصامت", grade: "حسن/صحيح بحسب طرقه وتخريجاته", url: "https://dorar.net/h/ON1P3cYf", note: "بيان المماثلة والتقابض في الأصناف الربوية" },
  bukhariHonesty: { kind: "hadith", book: "صحيح البخاري", reference: "2079", narrator: "حكيم بن حزام", grade: "صحيح", url: "https://dorar.net/h/CprzKiiP", note: "الصدق والبيان في البيع وأثرهما في البركة" },
  muslimGharar: { kind: "hadith", book: "صحيح مسلم", reference: "1513", narrator: "أبو هريرة", grade: "صحيح", url: "https://dorar.net/h/40OiBMg0", note: "النهي عن بيع الغرر وبيع الحصاة" },
  abuDawudNoOwnership: { kind: "hadith", book: "سنن أبي داود", reference: "3503", narrator: "حكيم بن حزام", grade: "صحيح عند عدد من أهل العلم", url: "https://dorar.net/h/5TZWP4hJ", note: "لا تبع ما ليس عندك" },
  muslimFraud: { kind: "hadith", book: "صحيح مسلم", reference: "101", narrator: "أبو هريرة", grade: "صحيح", url: "https://dorar.net/h/oWmXnhBy", note: "النهي عن الغش" }
};

const TOPICS = {
  riba_basics: {
    title: "الربا: تعريفه وصوره الأساسية",
    aliases: ["الربا", "ما هو الربا", "تحريم الربا", "ربا الفضل", "ربا النسيئة"],
    evidence: ["quranRiba", "muslimGold"],
    lessons: [
      "ابدأ بتحديد نوع العقد: قرض، بيع، صرف، استثمار، أو غير ذلك.",
      "افصل بين ربا الفضل وربا النسيئة، ولا تخلط بينهما في التطبيق.",
      "افحص العوضين، والجنس، والقدر، والتقابض، والأجل، وأي زيادة مشروطة.",
      "لا يُحكم على عقد معاصر من الاسم التجاري وحده؛ بل من حقيقته وشروطه وتكييفه الفقهي.",
      "إذا كانت الصورة المعاصرة مركبة أو اختلف فيها المعاصرون، يعرض النظام الأقوال الموثقة وتاريخ الفتوى وسبب الاختلاف."
    ],
    practice: [
      { scenario: "قرض نقدي اشترط فيه المقرض زيادة محددة عند السداد", expectedChecks: ["نوع العقد", "الزيادة المشروطة", "الأجل"] },
      { scenario: "مبادلة ذهب بذهب مع اختلاف الوزن", expectedChecks: ["الجنس", "المماثلة", "التقابض"] }
    ],
    warnings: ["لا يصدر المحرك فتوى شخصية ملزمة؛ يبين الحكم والدليل والتكييف، ويحيل المسألة المركبة إلى أهل العلم الموثوقين."]
  },
  gold_silver: {
    title: "بيع الذهب والفضة والصرف",
    aliases: ["بيع الذهب بالذهب", "ذهب بذهب", "بيع الذهب", "الذهب بالفضة", "الصرف", "تبديل الذهب"],
    evidence: ["muslimGold", "abuDawudGold"],
    lessons: [
      "حدّد هل المبادلة بين جنس ربوي واحد أو جنسين مختلفين.",
      "في الذهب بالذهب والفضة بالفضة: افحص المماثلة والتقابض وفق الحديث.",
      "في الذهب بالفضة: اختلاف الجنس لا يعني سقوط شرط التقابض في الصرف.",
      "في الذهب المصوغ والمعاصر: لا يختزل التطبيق في عبارة واحدة؛ يعرض التكييف وأقوال أهل العلم الموثقة عند الحاجة."
    ],
    practice: [
      { scenario: "10 غرام ذهب بذهب 12 غراماً مع تأخير التسليم", expectedChecks: ["اتحاد الجنس", "التفاضل", "التأخير"] },
      { scenario: "ذهب بفضة في مجلس العقد", expectedChecks: ["اختلاف الجنس", "التقابض"] }
    ],
    warnings: ["المصوغات والذهب المعاصر مسائل تحتاج إلى توصيف دقيق لطبيعة العقد والبدل والتقابض."]
  },
  debt_interest: {
    title: "الزيادة المشروطة في القرض والدين",
    aliases: ["فائدة القرض", "فوائد البنك", "زيادة القرض", "ربا الديون", "قرض بفائدة", "قرض ربوي"],
    evidence: ["quranRiba"],
    lessons: [
      "استخرج مبلغ القرض الأصلي والزيادة المشروطة وسبب الزيادة وموعدها.",
      "فرّق بين القرض وبين البيع أو الإجارة أو الاستثمار؛ فالتكييف يسبق الحكم.",
      "إذا كان العقد مصرفياً أو تمويلياً معاصراً، يعرض النظام بنوده الفعلية قبل الحكم عليه.",
      "لا يساوي المحرك بين كل عائد مالي وبين الربا؛ بل يفحص العقد ومصدر العائد والمخاطر والضمانات."
    ],
    practice: [
      { scenario: "اقترض شخص 10000 على أن يرد 11000 بعد سنة", expectedChecks: ["قرض", "زيادة مشروطة", "أجل"] },
      { scenario: "منتج تمويلي متعدد العقود", expectedChecks: ["العقود الداخلة", "الملكية", "المخاطر", "الشرط الجزائي", "الزيادة"] }
    ],
    warnings: ["لا تُسقط أحكام صورة مصرفية معاصرة قبل قراءة العقد والشروط والفتوى الخاصة بها."]
  },
  gharar: {
    title: "الغرر والجهالة في البيوع",
    aliases: ["الغرر", "بيع الغرر", "جهالة في البيع", "مخاطرة في البيع", "بيع مجهول"],
    evidence: ["muslimGharar"],
    lessons: [
      "افحص محل العقد: هل هو معلوم الوصف والقدر والقدرة على التسليم؟",
      "افحص احتمال النزاع الناتج عن الجهالة أو عدم القدرة على التسليم.",
      "لا تجعل كلمة الغرر حكماً آلياً على كل مخاطرة؛ يدرس نوع الغرر وقدره وأثره وما قاله الفقهاء في الصورة.",
      "يعرض التطبيق أمثلة البيع المنهي عنه ثم يختبر المعاملة الحديثة عليها دون إسقاط متعجل."
    ],
    practice: [
      { scenario: "بيع سلعة غير محددة الوصف ولا يقدر البائع على تسليمها", expectedChecks: ["الجهالة", "القدرة على التسليم", "النزاع"] }
    ]
  },
  forbidden_wealth: {
    title: "أكل أموال الناس بالباطل وأموال اليتامى",
    aliases: ["أكل أموال الناس", "مال اليتيم", "أكل مال اليتيم", "أموال اليتامى", "المال الحرام", "أكل المال بالباطل"],
    evidence: ["quranWealth"],
    lessons: [
      "حدّد صاحب المال وسبب انتقال المال وطبيعة الإذن.",
      "افحص هل يوجد غش أو خيانة أو رشوة أو استيلاء بغير حق أو تعد على مال اليتيم.",
      "في مال اليتيم: يميز النظام بين الحفظ والإدارة بالمعروف وبين الاعتداء أو الاستهلاك بغير حق.",
      "لا يكتفي النظام بعبارة حرام؛ بل يعرض النص والسبب والبديل المشروع متى توفر."
    ],
    practice: [
      { scenario: "وليّ يأخذ من مال اليتيم لنفقاته الشخصية بلا حق", expectedChecks: ["ملكية المال", "صفة الولي", "المصلحة", "الإذن الشرعي"] }
    ]
  },
  prohibited_trade: {
    title: "البيوع والمعاملات المحرمة",
    aliases: ["البيع المحرم", "الغش", "النجش", "بيع ما لا يملك", "الاحتكار", "القمار", "الميسر", "التدليس"],
    evidence: ["muslimFraud", "abuDawudNoOwnership", "quranGambling", "muslimGharar", "bukhariHonesty"],
    lessons: [
      "فحص الملكية والقدرة على التسليم.",
      "فحص الغش والتدليس وإخفاء العيوب.",
      "فحص الغرر والجهالة.",
      "فحص النجش والاحتكار والقمار والميسر بحسب صورة المعاملة.",
      "فحص الصدق والبيان وحق الخيار عند وجوده.",
      "بعد ذلك يربط النظام الصورة بالنصوص ثم بالتكييف الفقهي وأقوال العلماء."
    ],
    practice: [
      { scenario: "بائع يخفي عيباً مؤثراً في السلعة", expectedChecks: ["العيب", "الإخفاء", "الغش", "حق المشتري"] },
      { scenario: "شخص يبيع سلعة ليست في ملكه ولا في حيازته ثم يشتريها بعد العقد", expectedChecks: ["الملكية", "العقد السابق على التملك"] }
    ]
  },
  modern_finance_review: {
    title: "فحص المعاملات المالية المعاصرة",
    aliases: ["المعاملة البنكية", "تمويل", "تقسيط", "مرابحة", "تأمين", "بطاقة ائتمان", "محفظة إلكترونية", "شراء بالتقسيط"],
    evidence: ["quranRiba", "muslimGold", "muslimGharar", "abuDawudNoOwnership", "bukhariHonesty"],
    lessons: [
      "لا يصدر الحكم من الاسم: يستخرج النظام أطراف العقد، محل العقد، الثمن، الأجل، الضمان، الملكية، والشرط الجزائي.",
      "يفكك العقد المركب إلى عقوده الفرعية قبل التكييف.",
      "يقارن كل عقد فرعي بالنصوص والقواعد الفقهية والمذاهب وأقوال الهيئات والعلماء الموثقين.",
      "إذا بقيت معلومات ناقصة، يطلبها من المستخدم بدلاً من اختلاق صورة للعقد.",
      "تظهر الفتوى المعاصرة مع تاريخها ومصدرها حتى لا تختلط الأحكام القديمة بالقرارات الجديدة."
    ],
    warnings: ["هذا المحرك تعليمي بحثي، وليس بديلاً عن مراجعة عقد ملزم أو استفتاء أهل العلم في المعاملات المركبة."]
  }
};

function normalize(s) {
  return String(s || "")
    .toLocaleLowerCase("ar")
    .normalize("NFKC")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreAlias(question, alias) {
  const a = normalize(alias);
  if (!a || !question.includes(a)) return 0;
  return a.split(" ").length > 1 ? 30 + a.length / 10 : 10 + a.length / 20;
}

export function listTransactionTopics() {
  return Object.entries(TOPICS).map(([id, value]) => ({ id, title: value.title, aliases: value.aliases }));
}

export function getTransactionTopic(id) {
  const topic = TOPICS[id];
  return topic ? { id, ...topic, sources: topic.evidence.map((item) => typeof item === "string" ? SOURCES[item] : item) } : null;
}

export function routeTransactionQuestion(question) {
  const q = normalize(question);
  const ranked = Object.entries(TOPICS)
    .map(([id, topic]) => ({ id, score: Math.max(...topic.aliases.map((alias) => scoreAlias(q, alias)), 0) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  return {
    engineId: "fiqh-transactions",
    topicId: best?.score ? best.id : null,
    confidence: best?.score ? Math.min(best.score / 100, 1) : 0.1,
    candidates: ranked.filter((item) => item.score > 0).slice(0, 6)
  };
}

export function buildTransactionLesson(topicId, { language = "ar" } = {}) {
  const topic = getTransactionTopic(topicId);
  if (!topic) return null;
  return {
    engineId: "fiqh-transactions",
    topicId,
    language,
    title: topic.title,
    lessonFlow: [
      "1. تحديد حقيقة المعاملة والعقد.",
      "2. استخراج النصوص الأصلية المتعلقة بالصورة.",
      "3. التحقق من درجة الحديث وموضعه.",
      "4. التكييف الفقهي للمسألة.",
      "5. عرض أقوال العلماء والمذاهب المعتبرة عند وجود خلاف.",
      "6. تطبيق الحكم على الحالة المعروضة مع ذكر درجة اليقين.",
      "7. اقتراح البديل المباح إن كان متاحاً."
    ],
    lessons: topic.lessons,
    practice: topic.practice || [],
    evidence: topic.sources,
    warnings: topic.warnings || [],
    methodology: "فحص حقيقة العقد، ثم النصوص، ثم التخريج والتحقق، ثم التكييف الفقهي، ثم أقوال العلماء الموثقة، مع بيان الخلاف وعدم اختلاق الإجماع أو الفتوى.",
    outputPolicy: "إذا لم تكف الأدلة أو كانت تفاصيل العقد ناقصة، يصرح النظام بذلك ويطلب البيانات اللازمة بدلاً من الجزم."
  };
}

export function listTransactionEvidence() {
  return Object.entries(SOURCES).map(([id, source]) => ({ id, ...source }));
}
