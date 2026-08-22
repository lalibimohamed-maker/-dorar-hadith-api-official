import { narratorProfile } from "./rijal-network.js";
import { searchOfficialInstitutions } from "./official-institution-search.js";

function normalize(value) {
  return String(value || "").trim().toLocaleLowerCase("ar");
}

export function searchRijalResearch(query) {
  const q = normalize(query);
  if (!q) return { matched: false, query: "", profiles: [], officialSecondaryReferences: [] };

  const officialSecondaryReferences = searchOfficialInstitutions(query, { capability: "manuscripts" });
  const profile = narratorProfile(
    { id: `research:${q}`, nameAr: query },
    [],
    [],
    officialSecondaryReferences.map((item) => ({
      sourceId: item.id,
      title: item.title,
      source: item.source,
      sourceLayer: item.sourceLayer,
      verification: "official-institution-reference"
    }))
  );

  return {
    matched: true,
    query,
    profiles: [profile],
    officialSecondaryReferences,
    policy: {
      officialSourcesAreSecondary: true,
      primaryRijalEvidenceRequiredForJudgment: true,
      noAutomaticNarratorGrade: true,
      noteAr: "هذا مدخل بحثي أولي؛ لا يُنسب حكم إلى الراوي إلا من قول ناقد ومصدر موثق."
    }
  };
}
