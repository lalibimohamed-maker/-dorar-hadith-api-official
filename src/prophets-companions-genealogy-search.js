import { listBooks } from "./book-catalog.js";
import { listSources } from "./source-registry.js";

const topicRules = {
  prophets: {
    terms: ["نبي", "أنبياء", "النبي", "قصة", "قصص الأنبياء", "آدم", "نوح", "إبراهيم", "موسى", "عيسى", "يوسف", "داود", "سليمان", "أيوب", "يونس", "زكريا", "يحيى", "إسماعيل", "إسحاق", "يعقوب", "لوط", "هود", "صالح", "شعيب", "إدريس", "اليسع", "ذو الكفل"],
    books: ["قصص الأنبياء", "تفسير القرآن العظيم", "جامع البيان عن تأويل آي القرآن", "البداية والنهاية", "معالم التنزيل", "تفسير ابن أبي حاتم", "الجامع لأحكام القرآن", "البحر المحيط", "التحرير والتنوير", "تيسير الكريم الرحمن", "أضواء البيان"]
  },
  companions: {
    terms: ["صحابي", "صحابة", "الصحابة", "أخبار الصحابة", "رضي الله عنه", "رضي الله عنها", "أبو بكر", "عمر بن الخطاب", "عثمان بن عفان", "علي بن أبي طالب", "بلال", "خالد بن الوليد", "عائشة", "حفصة", "ابن عباس", "ابن عمر", "أبو هريرة"],
    books: ["الاستيعاب في معرفة الأصحاب", "الإصابة في تمييز الصحابة", "معرفة الصحابة", "أسد الغابة في معرفة الصحابة", "الطبقات الكبرى", "سير أعلام النبلاء", "التاريخ - خليفة بن خياط"]
  },
  genealogy: {
    terms: ["نسب", "أنساب", "قبيلة", "قبائل", "قريش", "بني هاشم", "بنو هاشم", "قحطان", "عدنان", "تميم", "هوازن", "كنانة", "الأزد", "ربيعة", "مضر", "العرب", "فخذ", "بطن", "عشيرة"],
    books: ["جمهرة أنساب العرب", "جمهرة نسب قريش وأخبارها", "الأنساب", "نهاية الأرب في معرفة أنساب العرب", "سبائك الذهب في معرفة قبائل العرب", "معجم قبائل العرب"]
  },
  history: {
    terms: ["تاريخ", "تاريخ الإسلام", "غزوة", "معركة", "خليفة", "خلافة", "دولة", "فتح", "فتوحات", "حدث", "وقعة", "مغازي"],
    books: ["تاريخ الرسل والملوك", "الكامل في التاريخ", "تاريخ الإسلام", "البداية والنهاية", "الطبقات الكبرى", "التاريخ - خليفة بن خياط"]
  }
};

function normalize(value) { return String(value || "").trim().toLocaleLowerCase("ar"); }

export function classifyHistoricalQuery(query) {
  const q = normalize(query);
  const scores = Object.entries(topicRules)
    .map(([topic, rule]) => ({ topic, score: rule.terms.reduce((n, term) => n + (q.includes(normalize(term)) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score);
  const best = scores[0];
  return best?.score ? { topic: best.topic, confidence: Math.min(1, best.score / 3), scores } : { topic: null, confidence: 0, scores };
}

export function historicalSourceRecords(topic) {
  const rule = topicRules[topic];
  if (!rule) return [];
  const books = listBooks().filter((book) => rule.books.some((title) => normalize(book.title || book.nameAr).includes(normalize(title)) || normalize(title).includes(normalize(book.title || book.nameAr))));
  const registry = listSources().filter((source) => rule.books.some((title) => normalize(source.nameAr || source.id).includes(normalize(title)) || normalize(title).includes(normalize(source.nameAr || source.id))));
  const seen = new Set();
  return [...books.map((book) => ({ id: `book:${book.id}`, type: "book", title: book.title || book.nameAr, author: book.authorNameAr || book.author || null, source: book.url || book.source || null, verification: "catalog-record", topic })), ...registry.map((source) => ({ id: `source:${source.id}`, type: "source", title: source.nameAr || source.id, source: source.url || null, verification: source.verification || "registry-record", topic }))]
    .filter((item) => { if (seen.has(item.id)) return false; seen.add(item.id); return true; });
}

export function buildHistoricalResearchContext(query) {
  const classification = classifyHistoricalQuery(query);
  if (!classification.topic) return { classification, records: [], method: "لم يُصنف البحث تلقائيًا؛ يُستكمل البحث العام دون افتراض المجال." };
  return {
    classification,
    records: historicalSourceRecords(classification.topic),
    method: {
      prophets: "القرآن ثم السنة الصحيحة ثم الآثار الثابتة ثم التفسير بالمأثور، مع تمييز الإسرائيليات والأخبار غير الثابتة.",
      companions: "السنة الصحيحة ثم مصادر التراجم المبكرة ثم الاستيعاب والإصابة وأسد الغابة وغيرها، مع فصل ثبوت الصحبة عن صحة الخبر.",
      genealogy: "المصادر المبكرة والمتخصصة ثم المصادر الجامعة، مع مقارنة الروايات وعدم القطع بنسب من مصدر واحد.",
      history: "تُجمع الرواية من المصادر المبكرة والكتب الجامعة مع مقارنة الأسانيد والنقول، ولا يُجعل مجرد ورود الخبر في كتاب تاريخ دليل صحة.",
    }[classification.topic],
    policy: { showSource: true, showDisagreement: true, noAutomaticCertainty: true, separateFactFromReport: true, distinguishHistoricalReportFromAuthenticNarration: true },
  };
}
