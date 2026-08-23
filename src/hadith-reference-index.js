export function indexHadithReferences(records = []) {
  const index = new Map();
  for (const record of records) {
    if (!record?.hadithId || !record?.sourceId || !record?.reference) continue;
    const key = `${record.sourceId}:${record.reference}`;
    const list = index.get(key) || [];
    list.push(record.hadithId);
    index.set(key, list);
  }
  return Object.fromEntries(index.entries());
}

export function findHadithByReference(index = {}, sourceId, reference) {
  return index[`${sourceId}:${reference}`] || [];
}
