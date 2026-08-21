import curriculum from "../config/tajweed-curriculum.json" with { type: "json" };

export function listTajweedLessons() {
  return [...curriculum.lessons].sort((a, b) => a.order - b.order);
}

export function getTajweedLesson(id) {
  return curriculum.lessons.find((lesson) => lesson.id === id) || null;
}

export function searchTajweedLessons(query = "") {
  const q = String(query).trim().toLowerCase();
  if (!q) return listTajweedLessons();
  return curriculum.lessons.filter((lesson) =>
    [lesson.id, lesson.titleAr, ...(lesson.skills || [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q)
  );
}

export function getTajweedCurriculum() {
  return {
    id: curriculum.id,
    titleAr: curriculum.titleAr,
    descriptionAr: curriculum.descriptionAr,
    lessons: listTajweedLessons(),
    sourceReferences: curriculum.sourceReferences,
    contentPolicy: curriculum.contentPolicy,
    expansion: curriculum.expansion,
  };
}
