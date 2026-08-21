import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const supplementPath = path.join(root, "..", "config", "sirah-supplement.json");
const supplement = JSON.parse(fs.readFileSync(supplementPath, "utf8"));

const EVENTS = [
  { id: "badr", name: "غزوة بدر", aliases: ["بدر", "يوم الفرقان"], sources: ["السيرة النبوية - ابن هشام", "المغازي", "زاد المعاد"], quran: ["3:123", "8:5", "8:41", "3:13"] },
  { id: "uhud", name: "غزوة أحد", aliases: ["أحد"], sources: ["السيرة النبوية - ابن هشام", "زاد المعاد", "الطبقات الكبرى"], quran: ["3:121", "3:152", "3:165"] },
  { id: "khandaq", name: "غزوة الخندق", aliases: ["الأحزاب", "الخندق"], sources: ["السيرة النبوية - ابن هشام", "زاد المعاد", "سبل الهدى والرشاد"], quran: ["33:9", "33:10", "33:20", "33:22"] },
  { id: "hudaybiyyah", name: "صلح الحديبية", aliases: ["الحديبية", "بيعة الرضوان"], sources: ["السيرة النبوية - ابن هشام", "إمتاع الأسماع", "الرحيق المختوم"], quran: ["48:1", "48:10", "48:18", "48:27"] },
  { id: "fath-makkah", name: "فتح مكة", aliases: ["فتح مكة"], sources: ["السيرة النبوية - ابن هشام", "الرحيق المختوم", "سبل الهدى والرشاد"], quran: ["110:1", "48:27"] }
];

export function listSirahEvents({ quranKey, query } = {}) {
  const key = String(quranKey || "").trim();
  const q = String(query || "").trim().toLowerCase();
  return EVENTS.filter((event) => {
    const byQuran = !key || event.quran.includes(key);
    const haystack = [event.name, ...event.aliases].join(" ").toLowerCase();
    return byQuran && (!q || haystack.includes(q));
  });
}

export function getSirahEvent(id) {
  return EVENTS.find((event) => event.id === id) || null;
}

export function listSirahBooks({ subject, method } = {}) {
  return supplement.books.filter((book) =>
    (!subject || book.subject === subject) && (!method || book.method === method)
  );
}

export function getSirahBook(id) {
  return supplement.books.find((book) => book.id === id) || null;
}

export function getSirahPolicy() {
  return supplement.policy;
}
