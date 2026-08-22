import { narratorProfile } from "./rijal-network.js";
import { searchOfficialInstitutions } from "./official-institution-search.js";
import bookAccess from "../config/rijal-book-access.json" with { type: "json" };

function normalize(value) { return String(value || "").trim().toLocaleLowerCase("ar"); }
function attachBookAccess(judgment) {
  const sourceId = judgment.sourceId || judgment.source?.id;
  const book = bookAccess.books.find((item) => item.id === sourceId || item.sourceId === sourceId);
  return book ? { ...judgment, bookAccess: book } : judgment;
}
export function searchRijalResearch(query, { judgments = [], links = [] } = {}) {
  const q = normalize(query);
  if (!q) return { matched:false, query:"", profiles:[], officialSecondaryReferences:[], bookAccess:[] };
  const officialSecondaryReferences = searchOfficialInstitutions(query, { capability:"manuscripts" });
  const normalizedJudgments = judgments.map(attachBookAccess);
  const profile = narratorProfile({ id:`research:${q}`, nameAr:query }, normalizedJudgments, links,
    officialSecondaryReferences.map((item) => ({ sourceId:item.id, title:item.title, source:item.source, sourceLayer:item.sourceLayer, verification:"official-institution-reference" })));
  return { matched:true, query, profiles:[profile], officialSecondaryReferences, bookAccess:bookAccess.books,
    policy:{ sourceNavigationEnabled:true, officialSourcesAreSecondary:true, primaryRijalEvidenceRequiredForJudgment:true, noAutomaticNarratorGrade:true,
      noteAr:"يُعرض الكتاب وموضع الاستشهاد ورابط القراءة عند توفره، ولا يُنسب حكم إلى الراوي إلا من قول ناقد ومصدر موثق." } };
}
