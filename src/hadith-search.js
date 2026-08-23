export function searchHadith(records = [], query = '', options = {}) {
  const q = String(query).trim().toLowerCase();
  const source = options.sourceId || null;
  return records.filter((r) => {
    if (source && r.sourceId !== source) return false;
    if (!q) return true;
    return [r.text, r.reference, r.hadithId].some((v) => String(v || '').toLowerCase().includes(q));
  }).map((r) => ({ hadithId:r.hadithId, text:r.text || null, sourceId:r.sourceId || null, reference:r.reference || null }));
}
