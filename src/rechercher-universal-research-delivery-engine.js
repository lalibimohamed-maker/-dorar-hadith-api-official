const SUPPORTED_FORMATS = Object.freeze([
  'pdf',
  'docx',
  'pptx',
  'epub',
  'html',
  'odt',
  'rtf',
  'txt',
  'markdown',
  'tei',
]);

const FORMAT_FAMILIES = Object.freeze({
  pdf: 'document',
  docx: 'document',
  odt: 'document',
  rtf: 'document',
  txt: 'text',
  markdown: 'text',
  tei: 'structured_text',
  epub: 'ebook',
  html: 'web',
  pptx: 'presentation',
});

const RIGHTS_BLOCKING_STATES = new Set([
  'RESTRICTED',
  'UNKNOWN',
  'EXPLICIT_PERMISSION_REQUIRED',
]);

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required`);
  }
}

function assertAllowedFormat(format) {
  if (!SUPPORTED_FORMATS.includes(format)) {
    throw new Error(`unsupported export format: ${format}`);
  }
}

function assertRightsForDelivery(rightsState, deliveryMode) {
  if (deliveryMode === 'PUBLIC_DOWNLOAD' && RIGHTS_BLOCKING_STATES.has(rightsState)) {
    throw new Error(`public download blocked by rights state: ${rightsState}`);
  }
}

function normalizeRequest(request = {}) {
  assertNonEmpty(request.sourceId, 'sourceId');
  assertNonEmpty(request.requestId, 'requestId');
  assertAllowedFormat(request.format);

  const language = request.language || 'source';
  const deliveryMode = request.deliveryMode || 'PUBLIC_DOWNLOAD';

  if (!['PUBLIC_DOWNLOAD', 'PRIVATE_EXPORT', 'RESEARCH_EXPORT'].includes(deliveryMode)) {
    throw new Error(`unsupported delivery mode: ${deliveryMode}`);
  }

  return Object.freeze({
    requestId: request.requestId,
    sourceId: request.sourceId,
    workId: request.workId || null,
    editionId: request.editionId || null,
    language,
    format: request.format,
    deliveryMode,
    preserveSourceLanguage: request.preserveSourceLanguage !== false,
    includeCitations: request.includeCitations !== false,
    includeProvenance: request.includeProvenance !== false,
    includePageLinks: request.includePageLinks !== false,
  });
}

export function createUniversalResearchDeliveryPlan(request = {}, source = {}) {
  const normalized = normalizeRequest(request);
  const rightsState = source.rightsState || 'UNKNOWN';

  assertRightsForDelivery(rightsState, normalized.deliveryMode);

  const derivedArtifact = {
    artifactType: 'DERIVED_EXPORT',
    sourceId: normalized.sourceId,
    workId: normalized.workId,
    editionId: normalized.editionId,
    sourceHash: source.contentHash || null,
    sourceLanguage: source.language || null,
    requestedLanguage: normalized.language,
    format: normalized.format,
    formatFamily: FORMAT_FAMILIES[normalized.format],
    rightsState,
    includeCitations: normalized.includeCitations,
    includeProvenance: normalized.includeProvenance,
    includePageLinks: normalized.includePageLinks,
    preserveSourceLanguage: normalized.preserveSourceLanguage,
  };

  return Object.freeze({
    request: normalized,
    derivedArtifact: Object.freeze(derivedArtifact),
    invariants: Object.freeze({
      sourceImmutable: true,
      originalPdfImmutable: true,
      canonicalQuranArabicImmutable: true,
      provenanceRequired: normalized.includeProvenance,
      citationsRequired: normalized.includeCitations,
      rightsGateRequired: true,
      translationIsDerived: normalized.language !== 'source',
    }),
    status: 'READY_FOR_DERIVATION',
  });
}

export function canDeliverResearchExport(request, source) {
  try {
    createUniversalResearchDeliveryPlan(request, source);
    return true;
  } catch {
    return false;
  }
}

export function deliveryEngineCapabilities() {
  return Object.freeze({
    stageId: 'UNIVERSAL_RESEARCH_DELIVERY',
    capabilities: [
      'FORMAT_NEGOTIATION',
      'LANGUAGE_NEGOTIATION',
      'SOURCE_PRESERVATION',
      'PROVENANCE_PRESERVATION',
      'CITATION_PRESERVATION',
      'PAGE_LINK_PRESERVATION',
      'RIGHTS_AWARE_EXPORT',
      'DERIVED_ARTIFACT_TRACKING',
    ],
    supportedFormats: SUPPORTED_FORMATS,
    deliveryModes: ['PUBLIC_DOWNLOAD', 'PRIVATE_EXPORT', 'RESEARCH_EXPORT'],
  });
}
