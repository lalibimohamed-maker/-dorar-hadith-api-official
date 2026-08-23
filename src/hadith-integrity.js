export function hadithIntegrityReport(records = []) {
  const report = { total: records.length, missingProvenance: 0, missingChain: 0, ready: 0 };
  for (const r of records) {
    const provenance = Boolean(r?.hadithId && r?.sourceId && r?.reference);
    const chain = Array.isArray(r?.chain) && r.chain.length > 0;
    if (!provenance) report.missingProvenance += 1;
    if (!chain) report.missingChain += 1;
    if (provenance && chain) report.ready += 1;
  }
  return { ...report, integrity: report.missingProvenance === 0 && report.missingChain === 0 };
}
