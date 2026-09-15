import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canDeliverResearchExport,
  createUniversalResearchDeliveryPlan,
  deliveryEngineCapabilities,
} from '../src/rechercher-universal-research-delivery-engine.js';

test('builds a provenance-preserving PDF delivery plan', () => {
  const plan = createUniversalResearchDeliveryPlan(
    {
      requestId: 'req-pdf-1',
      sourceId: 'src-1',
      workId: 'work-1',
      editionId: 'edition-1',
      language: 'ar',
      format: 'pdf',
    },
    {
      contentHash: 'sha256:abc',
      language: 'ar',
      rightsState: 'ALLOWED',
    },
  );

  assert.equal(plan.status, 'READY_FOR_DERIVATION');
  assert.equal(plan.derivedArtifact.format, 'pdf');
  assert.equal(plan.derivedArtifact.sourceHash, 'sha256:abc');
  assert.equal(plan.invariants.sourceImmutable, true);
});

test('supports foreign-language derived research exports', () => {
  const plan = createUniversalResearchDeliveryPlan(
    {
      requestId: 'req-fr-1',
      sourceId: 'src-2',
      language: 'fr',
      format: 'docx',
      deliveryMode: 'RESEARCH_EXPORT',
    },
    {
      contentHash: 'sha256:def',
      language: 'ar',
      rightsState: 'ALLOWED',
    },
  );

  assert.equal(plan.derivedArtifact.requestedLanguage, 'fr');
  assert.equal(plan.derivedArtifact.format, 'docx');
  assert.equal(plan.invariants.translationIsDerived, true);
  assert.equal(plan.invariants.provenanceRequired, true);
});

test('supports presentation and ebook exports', () => {
  assert.equal(canDeliverResearchExport(
    { requestId: 'pptx', sourceId: 'src', format: 'pptx' },
    { rightsState: 'ALLOWED' },
  ), true);
  assert.equal(canDeliverResearchExport(
    { requestId: 'epub', sourceId: 'src', format: 'epub' },
    { rightsState: 'ALLOWED' },
  ), true);
});

test('rights-blocked material cannot become a public download', () => {
  assert.throws(
    () => createUniversalResearchDeliveryPlan(
      { requestId: 'blocked', sourceId: 'src', format: 'pdf', deliveryMode: 'PUBLIC_DOWNLOAD' },
      { rightsState: 'UNKNOWN' },
    ),
    /public download blocked by rights state/,
  );
});

test('private/research export does not bypass the rights state into public publication', () => {
  const plan = createUniversalResearchDeliveryPlan(
    { requestId: 'private', sourceId: 'src', format: 'docx', deliveryMode: 'PRIVATE_EXPORT' },
    { rightsState: 'UNKNOWN' },
  );
  assert.equal(plan.derivedArtifact.rightsState, 'UNKNOWN');
  assert.equal(plan.invariants.rightsGateRequired, true);
});

test('exposes stable delivery capabilities', () => {
  const capabilities = deliveryEngineCapabilities();
  assert.equal(capabilities.stageId, 'UNIVERSAL_RESEARCH_DELIVERY');
  assert.ok(capabilities.capabilities.includes('RIGHTS_AWARE_EXPORT'));
  assert.ok(capabilities.supportedFormats.includes('docx'));
  assert.ok(capabilities.supportedFormats.includes('pptx'));
});
