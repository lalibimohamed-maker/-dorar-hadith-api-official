import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createUniversalFormatExportEngine,
  createDefaultExportRequest,
  UNIVERSAL_EXPORT_INVARIANTS,
} from '../src/rechercher-universal-format-export-engine.js';

const asset = {
  sourceIdentity: 'work:example|edition:1|manifestation:1',
  contentHash: 'sha256:example',
  sourceFormat: 'PAGE_IMAGES',
  sourceLanguage: 'ar',
  rightsState: 'ALLOWED',
};

test('plans PDF export from page images without replacing the master', () => {
  const engine = createUniversalFormatExportEngine();
  const plan = engine.planExport(asset, createDefaultExportRequest('PDF'));
  assert.equal(plan.outputFormat, 'PDF');
  assert.equal(plan.derived, true);
  assert.equal(plan.preserveSource, true);
  assert.equal(plan.sourceHash, asset.contentHash);
});

test('plans editable DOCX and presentation PPTX exports', () => {
  const engine = createUniversalFormatExportEngine();
  const docx = engine.planExport(asset, createDefaultExportRequest('DOCX'));
  const pptx = engine.planExport(asset, createDefaultExportRequest('PPTX'));
  assert.equal(docx.outputFormat, 'DOCX');
  assert.equal(pptx.outputFormat, 'PPTX');
});

test('supports multilingual derived exports while preserving source language', () => {
  const engine = createUniversalFormatExportEngine();
  const request = createDefaultExportRequest('DOCX', 'fr');
  const plan = engine.planExport(asset, request);
  assert.equal(plan.outputLanguage, 'fr');
  assert.equal(plan.mode, 'TRANSLATION_WITH_SOURCE');
  assert.equal(plan.sourceHash, asset.contentHash);
});

test('blocks rights-unknown exports', () => {
  const engine = createUniversalFormatExportEngine();
  assert.throws(() => engine.planExport({ ...asset, rightsState: 'UNKNOWN' }, createDefaultExportRequest('PDF')), /rights state/);
});

test('requires immutable source identity and hash', () => {
  const engine = createUniversalFormatExportEngine();
  assert.throws(() => engine.planExport({ ...asset, contentHash: undefined }, createDefaultExportRequest('PDF')), /contentHash/);
});

test('keeps universal export invariants explicit', () => {
  assert.equal(UNIVERSAL_EXPORT_INVARIANTS.sourceMasterImmutable, true);
  assert.equal(UNIVERSAL_EXPORT_INVARIANTS.originalPdfImmutable, true);
  assert.equal(UNIVERSAL_EXPORT_INVARIANTS.canonicalQuranArabicImmutable, true);
  assert.equal(UNIVERSAL_EXPORT_INVARIANTS.derivedExportNeverBecomesSource, true);
  assert.equal(UNIVERSAL_EXPORT_INVARIANTS.translationProvenanceRequired, true);
});
