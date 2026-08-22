import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.join(__dirname, "..", "config");
const registry = JSON.parse(fs.readFileSync(path.join(configDir, "source-registry.json"), "utf8"));

function readJson(name, fallback) {
  const file = path.join(configDir, name);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
}

const fatwaExpansion = readJson("fatwa-source-expansion-2026.json", { sources: [], taxonomy: [] });
const saudiFatwaExpansion = readJson("saudi-official-fatwa-sources-2026.json", { sources: [], policy: {}, institutionalOutputRules: {} });
const secondaryFatwaExpansion = readJson("secondary-fatwa-reference-sources-2026.json", { sources: [], policy: {} });
const contemporaryScholars = readJson("contemporary-sunni-scholars.json", { scholars: [] });
const knowledgeExpansion = readJson("knowledge-source-expansion-2026.json", { sources: [], policy: {}, rules: {} });
const officialExpansion = readJson("official-islamic-sources-2026.json", { sources: [], policy: {}, researchRule: "" });
const academicExpansion = readJson("academic-islamic-sources-2026.json", { sources: [], policy: {} });
const bookCatalog = readJson("book-catalog-2026.json", { books: [], policy: {}, normalizationRules: {} });
const fiqhBookExpansion = readJson("fiqh-book-expansion-2026.json", { books: [], policy: {} });
const classicalFatwaCatalog = readJson("classical-fatwa-catalog-2026.json", { works: [], policy: {} });

const fatwaSources = (fatwaExpansion.sources || []).map((source) => ({ ...source, category: "fatwa", role: source.type === "official-scholar-site" || source.type === "official-foundation-site" ? "official-fatwa-source" : "fatwa-source", sourceKind: source.type || "fatwa-source", reusePolicy: source.reuse || "source-permission-dependent" }));
const saudiFatwaSources = (saudiFatwaExpansion.sources || []).map((source) => ({ ...source, sourceKind: source.sourceKind || "saudi-official-fatwa-source", attributionRequired: true, noEndorsementByInclusion: true, reusePolicy: saudiFatwaExpansion.policy?.copyright || "catalog-and-link-unless-licensed", jurisdiction: "السعودية" }));
const secondaryFatwaSources = (secondaryFatwaExpansion.sources || []).map((source) => ({ ...source, sourceKind: source.sourceKind || "secondary-fatwa-reference", attributionRequired: true, noEndorsementByInclusion: true, secondary: true, reusePolicy: "catalog-and-link-unless-licensed" }));
const scholarSources = (contemporaryScholars.scholars || []).flatMap((scholar) => (scholar.sources || []).map((source) => ({ id: `scholar-${scholar.id}`, nameAr: source.nameAr || scholar.nameAr, scholar: scholar.nameAr, category: "fatwa", url: source.url, role: "official-fatwa-source", sourceKind: source.type || "scholar-source", contentTypes: scholar.contentTypes || [], attributionRequired: true, noEndorsementByInclusion: true })));
const expandedSources = (knowledgeExpansion.sources || []).map((source) => ({ ...source, sourceKind: source.role || "knowledge-source", attributionRequired: true, noEndorsementByInclusion: true, reusePolicy: source.reuse || "catalog-and-link-unless-licensed" }));
const officialSources = (officialExpansion.sources || []).map((source) => ({ ...source, sourceKind: source.role || "official-source", attributionRequired: true, noEndorsementByInclusion: true, reusePolicy: "catalog-and-link-unless-licensed" }));
const academicSources = (academicExpansion.sources || []).map((source) => ({ ...source, sourceKind: source.role || "academic-source", attributionRequired: true, noEndorsementByInclusion: true, reusePolicy: "catalog-and-link-unless-licensed" }));

const categories = [...registry.categories, { id: "fatwa", nameAr: "الفتاوى ومصادر العلماء" }, { id: "history", nameAr: "التاريخ والأخبار" }, { id: "companions", nameAr: "أخبار الصحابة وتراجمهم" }, { id: "genealogy", nameAr: "الأنساب والقبائل" }, { id: "hadith-sciences", nameAr: "علوم الحديث ونقد الرواية" }, { id: "scholars", nameAr: "مصادر العلماء" }, { id: "research", nameAr: "مراكز البحوث والدراسات" }, { id: "academic", nameAr: "الجامعات والمؤسسات الأكاديمية" }, { id: "manuscripts", nameAr: "المخطوطات والفهارس" }].filter((category, index, all) => all.findIndex((item) => item.id === category.id) === index);
const sourceIds = new Set(registry.sources.map((source) => source.id));
const mergedSources = [...registry.sources, ...fatwaSources.filter((source) => !sourceIds.has(source.id)), ...saudiFatwaSources.filter((source) => !sourceIds.has(source.id)), ...secondaryFatwaSources.filter((source) => !sourceIds.has(source.id)), ...scholarSources.filter((source) => !sourceIds.has(source.id)), ...expandedSources.filter((source) => !sourceIds.has(source.id)), ...officialSources.filter((source) => !sourceIds.has(source.id)), ...academicSources.filter((source) => !sourceIds.has(source.id))];
const mergedBookCatalog = [...(bookCatalog.books || []), ...(fiqhBookExpansion.books || [])];
const bookIds = new Set();
const normalizedBooks = mergedBookCatalog.filter((book) => { if (bookIds.has(book.id)) return false; bookIds.add(book.id); return true; });

const mergedRegistry = {
  ...registry,
  categories,
  sources: mergedSources,
  books: normalizedBooks,
  classicalFatwaWorks: classicalFatwaCatalog.works || [],
  bookCatalog: { policy: bookCatalog.policy || {}, normalizationRules: { ...(bookCatalog.normalizationRules || {}), ...(fiqhBookExpansion.policy || {}) }, bookCount: normalizedBooks.length, fiqhExpansionCount: (fiqhBookExpansion.books || []).length },
  fatwa: { taxonomy: fatwaExpansion.taxonomy || [], sourceCount: mergedSources.filter((source) => source.category === "fatwa").length, scholarCount: new Set(scholarSources.map((source) => source.scholar).filter(Boolean)).size, officialSaudiSourceCount: saudiFatwaSources.filter((source) => source.category === "fatwa").length, secondaryReferenceSourceCount: secondaryFatwaSources.filter((source) => source.category === "fatwa").length, classicalWorkCount: (classicalFatwaCatalog.works || []).length, policy: fatwaExpansion.policy || null, saudiPolicy: saudiFatwaExpansion.policy || null, secondaryPolicy: secondaryFatwaExpansion.policy || null, institutionalOutputRules: saudiFatwaExpansion.institutionalOutputRules || {} },
  knowledgeExpansion: { policy: knowledgeExpansion.policy || {}, rules: knowledgeExpansion.rules || {}, sourceCount: expandedSources.length },
  officialExpansion: { policy: officialExpansion.policy || {}, researchRule: officialExpansion.researchRule || "", sourceCount: officialSources.length },
  academicExpansion: { policy: academicExpansion.policy || {}, sourceCount: academicSources.length },
};

export function getRegistry() { return mergedRegistry; }
export function listSources({ category, role, country, secondary } = {}) { return mergedRegistry.sources.filter((source) => (!category || source.category === category) && (!role || source.role === role) && (!country || source.country === country) && (secondary === undefined || Boolean(source.secondary) === secondary)); }
export function getSource(id) { return mergedRegistry.sources.find((source) => source.id === id) || null; }
export function listCategories() { return mergedRegistry.categories; }
export function getMaqasid() { return mergedRegistry.maqasid; }
export function listBooks({ category, authorAr, madhhab } = {}) { return mergedRegistry.books.filter((book) => (!category || book.category === category) && (!authorAr || book.authorAr === authorAr) && (!madhhab || book.madhhab === madhhab)); }
export function getBook(id) { return mergedRegistry.books.find((book) => book.id === id) || null; }
export function listClassicalFatwaWorks({ authorAr } = {}) { return mergedRegistry.classicalFatwaWorks.filter((work) => !authorAr || work.authorAr === authorAr); }
export function getClassicalFatwaWork(id) { return mergedRegistry.classicalFatwaWorks.find((work) => work.id === id) || null; }
