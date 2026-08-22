import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.join(__dirname, "..", "config");
const registry = JSON.parse(fs.readFileSync(path.join(configDir, "source-registry.json"), "utf8"));
function readJson(name, fallback) { const file = path.join(configDir, name); return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback; }
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
const languageCoverage = readJson("language-coverage-2026.json", { agreed20: [], worldExpansion: {}, policy: {}, translationTiers: {} });
const arabicLanguage = readJson("arabic-language-primary-sources-2026.json", { sources: [], classicalReferenceFamilies: [], fiqhTerminology: {}, policy: {} });
const fiqhTerminologyMap = readJson("fiqh-terminology-lexical-map-2026.json", { terms: [], resolutionOrder: [], policy: {} });
const fiqhTerminologyExpansion = readJson("fiqh-terminology-expansion-2026.json", { terms: [], domains: [], policy: {} });
const lexicalDecomposition = readJson("arabic-lexical-decomposition-2026.json", { layers: [], primaryLexicalSources: [], decompositionRecord: {}, reviewStatuses: [], policy: {} });
const globalFatwaAuthorities = readJson("global-fatwa-authorities-2026.json", { umbrella: {}, verifiedAuthorities: [], nextAuditRegions: [], auditFields: [], policy: {} });
const translationPipeline = readJson("translation-pipeline-2026.json", { sourceLanguage: "ar", priorityLanguages: [], globalExpansion: true, pipeline: [], contentTypes: [], statuses: [], translationRecord: {}, safetyRules: {} });
const ingestionPipeline = readJson("ingestion-normalization-pipeline-2026.json", { version: "", pipeline: [], canonicalRecord: {}, sourceTypes: [], normalization: {}, rights: {}, reviewStatuses: [] });
const translationCorpusPlan = readJson("translation-corpus-plan-2026.json", { version: "", sourceLanguage: "ar", priorityLanguages: [], worldExpansion: true, corpusUnits: [], translationMemory: {}, qa: {}, terminology: {}, releasePolicy: {} });
const globalFatwaAuditPlan = readJson("global-fatwa-audit-plan-2026.json", { version: "", verificationLevels: [], requiredEvidence: [], auditRegions: [], countryRecordRequired: [], primaryPolicy: {}, secondaryPolicy: {} });
const mapSource = (source, defaults = {}) => ({ ...source, ...defaults, attributionRequired: true, noEndorsementByInclusion: true });
const fatwaSources = (fatwaExpansion.sources || []).map((source) => mapSource(source, { category: "fatwa", role: source.type === "official-scholar-site" || source.type === "official-foundation-site" ? "official-fatwa-source" : "fatwa-source", sourceKind: source.type || "fatwa-source", reusePolicy: source.reuse || "source-permission-dependent" }));
const saudiFatwaSources = (saudiFatwaExpansion.sources || []).map((source) => mapSource(source, { sourceKind: source.sourceKind || "saudi-official-fatwa-source", reusePolicy: saudiFatwaExpansion.policy?.copyright || "catalog-and-link-unless-licensed", jurisdiction: "السعودية" }));
const secondaryFatwaSources = (secondaryFatwaExpansion.sources || []).map((source) => mapSource(source, { sourceKind: source.sourceKind || "secondary-fatwa-reference", secondary: true, reusePolicy: "catalog-and-link-unless-licensed" }));
const scholarSources = (contemporaryScholars.scholars || []).flatMap((scholar) => (scholar.sources || []).map((source) => mapSource({ id: `scholar-${scholar.id}`, nameAr: source.nameAr || scholar.nameAr, scholar: scholar.nameAr, category: "fatwa", url: source.url, role: "official-fatwa-source", sourceKind: source.type || "scholar-source", contentTypes: scholar.contentTypes || [] })));
const expandedSources = (knowledgeExpansion.sources || []).map((source) => mapSource(source, { sourceKind: source.role || "knowledge-source", reusePolicy: source.reuse || "catalog-and-link-unless-licensed" }));
const officialSources = (officialExpansion.sources || []).map((source) => mapSource(source, { sourceKind: source.role || "official-source", reusePolicy: "catalog-and-link-unless-licensed" }));
const academicSources = (academicExpansion.sources || []).map((source) => mapSource(source, { sourceKind: source.role || "academic-source", reusePolicy: "catalog-and-link-unless-licensed" }));
const languageSources = (arabicLanguage.sources || []).map((source) => mapSource(source, { category: "arabic-language", role: source.priority || "primary-language-reference", sourceKind: source.kind || "language-source", language: "ar" }));
const categories = [...registry.categories, { id: "fatwa", nameAr: "الفتاوى ومصادر العلماء" }, { id: "arabic-language", nameAr: "اللغة العربية والمعاجم والمصطلحات" }, { id: "history", nameAr: "التاريخ والأخبار" }, { id: "companions", nameAr: "أخبار الصحابة وتراجمهم" }, { id: "genealogy", nameAr: "الأنساب والقبائل" }, { id: "hadith-sciences", nameAr: "علوم الحديث ونقد الرواية" }, { id: "scholars", nameAr: "مصادر العلماء" }, { id: "research", nameAr: "مراكز البحوث والدراسات" }, { id: "academic", nameAr: "الجامعات والمؤسسات الأكاديمية" }, { id: "manuscripts", nameAr: "المخطوطات والفهارس" }].filter((category, index, all) => all.findIndex((item) => item.id === category.id) === index);
const mergedSourceCandidates = [...registry.sources, ...fatwaSources, ...saudiFatwaSources, ...secondaryFatwaSources, ...scholarSources, ...expandedSources, ...officialSources, ...academicSources, ...languageSources];
const mergedSources = [...new Map(mergedSourceCandidates.filter((source) => source?.id).map((source) => [source.id, source])).values()];
const mergedBookCatalog = [...(bookCatalog.books || []), ...(fiqhBookExpansion.books || [])];
const bookIds = new Set();
const normalizedBooks = mergedBookCatalog.filter((book) => { if (bookIds.has(book.id)) return false; bookIds.add(book.id); return true; });
const mergedRegistry = { ...registry, categories, sources: mergedSources, books: normalizedBooks, classicalFatwaWorks: classicalFatwaCatalog.works || [], languages: languageCoverage, arabicLanguage: { ...arabicLanguage, sourceCount: languageSources.length, classicalReferenceFamilies: arabicLanguage.classicalReferenceFamilies || [], fiqhTerminology: arabicLanguage.fiqhTerminology || {} }, fiqhTerminology: { ...fiqhTerminologyMap, expansion: fiqhTerminologyExpansion }, lexicalDecomposition, globalFatwaAuthorities, translationPipeline, ingestionPipeline, translationCorpusPlan, globalFatwaAuditPlan, translation: { ...languageCoverage, ...translationPipeline, sourceLanguage: "ar", preserveOriginal: true, terminologySourcePriority: arabicLanguage.fiqhTerminology?.sourcePriority || [], terminologyMapVersion: fiqhTerminologyMap.version, translationTiers: languageCoverage.translationTiers || {}, pipelineVersion: translationPipeline.version, corpusPlanVersion: translationCorpusPlan.version, safetyRules: translationPipeline.safetyRules || translationPipeline.qualityGates || {} }, bookCatalog: { policy: bookCatalog.policy || {}, normalizationRules: { ...(bookCatalog.normalizationRules || {}), ...(fiqhBookExpansion.policy || {}) }, bookCount: normalizedBooks.length, fiqhExpansionCount: (fiqhBookExpansion.books || []).length }, fatwa: { taxonomy: fatwaExpansion.taxonomy || [], sourceCount: mergedSources.filter((source) => source.category === "fatwa").length, scholarCount: new Set(scholarSources.map((source) => source.scholar).filter(Boolean)).size, officialSaudiSourceCount: saudiFatwaSources.filter((source) => source.category === "fatwa").length, secondaryReferenceSourceCount: secondaryFatwaSources.filter((source) => source.category === "fatwa").length, classicalWorkCount: (classicalFatwaCatalog.works || []).length, policy: fatwaExpansion.policy || null, saudiPolicy: saudiFatwaExpansion.policy || null, secondaryPolicy: secondaryFatwaExpansion.policy || null, institutionalOutputRules: saudiFatwaExpansion.institutionalOutputRules || {} } };
export function getRegistry() { return mergedRegistry; }
export function listSources({ category, role, country, secondary } = {}) { return mergedRegistry.sources.filter((source) => (!category || source.category === category) && (!role || source.role === role) && (!country || source.country === country) && (secondary === undefined || Boolean(source.secondary) === secondary)); }
export function getSource(id) { return mergedRegistry.sources.find((source) => source.id === id) || null; }
export function listCategories() { return mergedRegistry.categories; }
export function getMaqasid() { return mergedRegistry.maqasid; }
export function listBooks({ category, authorAr, madhhab } = {}) { return mergedRegistry.books.filter((book) => (!category || book.category === category) && (!authorAr || book.authorAr === authorAr) && (!madhhab || book.madhhab === madhhab)); }
export function getBook(id) { return mergedRegistry.books.find((book) => book.id === id) || null; }
export function listClassicalFatwaWorks({ authorAr } = {}) { return mergedRegistry.classicalFatwaWorks.filter((work) => !authorAr || work.authorAr === authorAr); }
export function getClassicalFatwaWork(id) { return mergedRegistry.classicalFatwaWorks.find((work) => work.id === id) || null; }
export function listLanguages({ agreed20 = false } = {}) { return agreed20 ? (mergedRegistry.languages.agreed20 || []) : [...(mergedRegistry.languages.agreed20 || []), { code: "*", name: "worldwide-language-expansion" }]; }
export function listArabicLanguageSources({ role } = {}) { return mergedRegistry.sources.filter((source) => source.category === "arabic-language" && (!role || source.role === role)); }
export function getArabicTerminologyPolicy() { return mergedRegistry.arabicLanguage.fiqhTerminology; }
export function getFiqhTerminologyMap() { return mergedRegistry.fiqhTerminology; }
export function listFiqhTerms({ domain } = {}) { return (mergedRegistry.fiqhTerminology.expansion?.terms || mergedRegistry.fiqhTerminology.terms || []).filter((term) => !domain || (term.domains || term.technicalDomains || []).includes(domain)); }
export function getLexicalDecompositionPolicy() { return mergedRegistry.lexicalDecomposition; }
export function getGlobalFatwaAuthorityRegistry() { return mergedRegistry.globalFatwaAuthorities; }
export function listGlobalFatwaAuthorities({ country } = {}) { return (mergedRegistry.globalFatwaAuthorities.verifiedAuthorities || []).filter((authority) => !country || authority.country === country); }
export function getTranslationPolicy() { return mergedRegistry.translation; }
export function getIngestionPipeline() { return mergedRegistry.ingestionPipeline; }
export function getTranslationCorpusPlan() { return mergedRegistry.translationCorpusPlan; }
export function getGlobalFatwaAuditPlan() { return mergedRegistry.globalFatwaAuditPlan; }
