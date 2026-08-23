const REQUIRED_GRADE_FIELDS = ['id', 'hadithId', 'scholar', 'grade', 'sourceId', 'citation'];
const REQUIRED_TAKHRIJ_FIELDS = ['id', 'hadithId', 'sourceId', 'citation'];

export function validateScholarGrade(grade = {}) {
  const errors = [];
  for (const field of REQUIRED_GRADE_FIELDS) {
    if (grade[field] == null || grade[field] === '') errors.push(`grade:missing:${field}`);
  }
  if (grade.generated === true) errors.push('grade:generated-content-not-allowed');
  return { valid: errors.length === 0, errors };
}

export function validateTakhrij(entry = {}) {
  const errors = [];
  for (const field of REQUIRED_TAKHRIJ_FIELDS) {
    if (entry[field] == null || entry[field] === '') errors.push(`takhrij:missing:${field}`);
  }
  if (entry.generated === true) errors.push('takhrij:generated-content-not-allowed');
  return { valid: errors.length === 0, errors };
}

export function registerScholarGrade(registry, grade) {
  const result = validateScholarGrade(grade);
  if (!result.valid) throw new TypeError(`Invalid scholar grade: ${result.errors.join(',')}`);
  if (registry.has(grade.id)) throw new TypeError(`Duplicate scholar grade: ${grade.id}`);
  registry.set(grade.id, structuredClone(grade));
  return grade.id;
}

export function registerTakhrij(registry, entry) {
  const result = validateTakhrij(entry);
  if (!result.valid) throw new TypeError(`Invalid takhrij: ${result.errors.join(',')}`);
  if (registry.has(entry.id)) throw new TypeError(`Duplicate takhrij: ${entry.id}`);
  registry.set(entry.id, structuredClone(entry));
  return entry.id;
}

export function summarizeHadithGrades(grades = []) {
  const valid = grades.filter(g => validateScholarGrade(g).valid);
  return {
    count: valid.length,
    byGrade: Object.fromEntries(valid.reduce((map, g) => {
      map.set(g.grade, (map.get(g.grade) || 0) + 1);
      return map;
    }, new Map()))
  };
}
