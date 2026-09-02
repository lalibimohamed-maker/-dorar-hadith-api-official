/**
 * Automatic @Rechercher acquisition gate.
 *
 * A source may be discovered automatically, but a file is downloaded only when
 * the individual work/edition carries a redistributable or explicit license
 * decision and a concrete downloadable URL. Everything else remains routed to
 * read-only/link-only handling by the existing access policy.
 */

const DOWNLOADABLE_DECISIONS = new Set([
  'redistributable',
  'explicitly-licensed'
]);

const BLOCKED_DECISIONS = new Set([
  'conflict',
  'unclear',
  'work-protected',
  'underlying-work-protected',
  'edition-review',
  'link-only',
  'read-only'
]);

export function canAutoDownload(record = {}) {
  const rightsDecision = String(record.rightsDecision ?? '').toLowerCase();
  const url = record.downloadUrl ?? record.fileUrl ?? record.sourceFileUrl ?? null;

  if (!url || !/^https?:\/\//i.test(String(url))) return false;
  if (BLOCKED_DECISIONS.has(rightsDecision)) return false;
  return DOWNLOADABLE_DECISIONS.has(rightsDecision) && record.rightsVerified === true;
}

export function chooseAutoAcquisition(record = {}) {
  if (canAutoDownload(record)) {
    return {
      outcome: 'AUTO_DOWNLOAD',
      downloadUrl: record.downloadUrl ?? record.fileUrl ?? record.sourceFileUrl,
      rightsDecision: record.rightsDecision,
      rightsVerified: true,
      sourceId: record.sourceId ?? record.providerId ?? null
    };
  }

  const alternatives = Array.isArray(record.alternativeSources) ? record.alternativeSources : [];
  const alternative = alternatives.find(candidate => canAutoDownload(candidate));
  if (alternative) {
    return {
      outcome: 'AUTO_DOWNLOAD_ALTERNATIVE',
      downloadUrl: alternative.downloadUrl ?? alternative.fileUrl ?? alternative.sourceFileUrl,
      rightsDecision: alternative.rightsDecision,
      rightsVerified: true,
      sourceId: alternative.sourceId ?? alternative.providerId ?? null
    };
  }

  return {
    outcome: 'READ_ONLY_OR_LINK_ONLY',
    downloadUrl: null,
    rightsDecision: record.rightsDecision ?? 'unclear',
    rightsVerified: record.rightsVerified === true,
    sourceId: record.sourceId ?? record.providerId ?? null
  };
}

export function buildAutoAcquisitionPlan(records = []) {
  return records.map(record => ({
    id: record.id ?? record.workId ?? record.editionId ?? null,
    title: record.title ?? record.titleHint ?? null,
    sourceId: record.sourceId ?? record.providerId ?? null,
    ...chooseAutoAcquisition(record)
  }));
}
