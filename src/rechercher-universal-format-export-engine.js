const SUPPORTED_FORMATS = Object.freeze([
  'PDF', 'PDF_A', 'PDF_UA_WHEN_SUPPORTED', 'DOCX', 'PPTX', 'ODT', 'EPUB',
  'HTML', 'TXT', 'MARKDOWN', 'RTF', 'TEI', 'JATS',
]);

const SOURCE_FORMATS = Object.freeze([
  'PDF', 'DOCX', 'PPTX', 'ODT', 'EPUB', 'HTML', 'TXT', 'MARKDOWN', 'TEI',
  'JATS', 'IIIF_MANIFEST', 'IIIF_CANVAS', 'PAGE_IMAGES', 'MANUSCRIPT_IMAGES',
  'OCR_TEXT', 'RESEARCH_RESULT', 'LEARNING_ARTIFACT',
]);

const RIGHTS_BLOCKING = new Set(['UNKNOWN', 'RESTRICTED', 'EXPLICIT_PERMISSION_REQUIRED']);

function assertSupportedFormat(format) {
  if (!SUPPORTED_FORMATS.includes(format)) {
    throw new Error(`unsupported export format: ${format}`);
  }
}

function assertSourceFormat(format) {
  if (!SOURCE_FORMATS.includes(format)) {
    throw new Error(`unsupported source format: ${format}`);
  }
}

function assertRightsExportable(asset) {
  const rights = asset?.rightsState ?? 'UNKNOWN';
  if (RIGHTS_BLOCKING.has(rights)) {
    throw new Error(`export blocked by rights state: ${rights}`);
  }
}

function assertMasterIdentity(asset) {
  if (!asset?.sourceIdentity) throw new Error('sourceIdentity is required');
  if (!asset?.contentHash) throw new Error('contentHash is required');
}

export function createUniversalFormatExportEngine({ converterRegistry = {} } = {}) {
  return {
    sourceFormats: SOURCE_FORMATS,
    outputFormats: SUPPORTED_FORMATS,

    registerConverter(format, converter) {
      assertSupportedFormat(format);
      if (!converter || typeof converter.convert !== 'function') {
        throw new Error(`invalid converter for ${format}`);
      }
      converterRegistry[format] = converter;
    },

    planExport(asset, request = {}) {
      assertSourceFormat(asset?.sourceFormat);
      assertMasterIdentity(asset);
      assertRightsExportable(asset);
      assertSupportedFormat(request.format);
      const language = request.language ?? asset.sourceLanguage ?? 'SOURCE';
      return Object.freeze({
        sourceIdentity: asset.sourceIdentity,
        sourceHash: asset.contentHash,
        sourceFormat: asset.sourceFormat,
        outputFormat: request.format,
        outputLanguage: language,
        mode: request.mode ?? 'SOURCE_PRESERVING',
        derived: true,
        preserveSource: true,
        preserveCitations: true,
        preservePageReferences: true,
        preserveProvenance: true,
        rightsState: asset.rightsState,
      });
    },

    convert(asset, request = {}) {
      const plan = this.planExport(asset, request);
      const converter = converterRegistry[plan.outputFormat];
      if (!converter) {
        return { ...plan, status: 'PLANNED', reason: 'converter_adapter_not_registered' };
      }
      const result = converter.convert(asset, plan);
      return {
        ...plan,
        ...result,
        status: result?.status ?? 'CREATED',
        derived: true,
        sourceHash: asset.contentHash,
      };
    },

    canExport(asset, request = {}) {
      try {
        this.planExport(asset, request);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function createDefaultExportRequest(format, language = 'SOURCE') {
  assertSupportedFormat(format);
  return {
    format,
    language,
    mode: language === 'SOURCE' ? 'SOURCE_PRESERVING' : 'TRANSLATION_WITH_SOURCE',
  };
}

export const UNIVERSAL_EXPORT_INVARIANTS = Object.freeze({
  sourceMasterImmutable: true,
  originalPdfImmutable: true,
  canonicalQuranArabicImmutable: true,
  derivedExportNeverBecomesSource: true,
  rightsUnknownNotPublishable: true,
  translationProvenanceRequired: true,
  outputHashRequired: true,
});
