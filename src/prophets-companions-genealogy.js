import catalog from "../config/prophets-companions-genealogy.json" with { type: "json" };

export function getProphetsCompanionsGenealogyCatalog() {
  return structuredClone(catalog);
}

export function listProphetWorks() {
  return catalog.prophets.recommendedWorks.map((item) => ({ ...item }));
}

export function listCompanionWorks() {
  return catalog.companions.recommendedWorks.map((item) => ({ ...item }));
}

export function listGenealogyWorks() {
  return catalog.arabGenealogy.recommendedWorks.map((item) => ({ ...item }));
}

export function searchHistoricalSources(query, domain) {
  const q = String(query || "").trim().toLocaleLowerCase("ar");
  const sections = domain
    ? { [domain]: catalog[domain] }
    : { prophets: catalog.prophets, companions: catalog.companions, arabGenealogy: catalog.arabGenealogy };
  return Object.entries(sections).flatMap(([section, value]) => {
    const works = value?.recommendedWorks || [];
    return works
      .filter((item) => !q || `${item.titleAr} ${item.authorAr || ""}`.toLocaleLowerCase("ar").includes(q))
      .map((item) => ({ ...item, domain: section }));
  });
}
