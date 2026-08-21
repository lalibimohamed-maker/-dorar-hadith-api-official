import source from "../config/shamela-source.json" with { type: "json" };

export function getShamelaSource() {
  return structuredClone(source);
}

export function listShamelaSections() {
  return [...source.relevantSections];
}

export function searchShamelaSections(query = "") {
  const q = String(query).trim().toLowerCase();
  if (!q) return listShamelaSections();
  return source.relevantSections.filter((section) =>
    `${section.id} ${section.nameAr}`.toLowerCase().includes(q)
  );
}
