import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXTERNAL_STANDARDS,
  createWorldwideResourceRegistry,
  registerWorldwideResource,
  registerEngineResource,
  validateWorldwideResource,
  validateExternalStandardCoverage,
  buildWorldwideResourceAudit,
} from '../src/rechercher-worldwide-resource-registry-engine.js';

test('worldwide registry carries interoperability and preservation standards', () => {
  const registry = createWorldwideResourceRegistry();
  const standards = validateExternalStandardCoverage(registry);
  assert.equal(standards.valid, true);
  assert.equal(standards.present.length, Object.keys(EXTERNAL_STANDARDS).length);
});

test('resource registration requires rights and provenance fields', () => {
  const registry = createWorldwideResourceRegistry();
  const resource = registerWorldwideResource(registry, {
    resourceId: 'source:example:1',
    resourceType: 'MANUSCRIPT_REPOSITORY',
    title: 'Example manuscript',
    sourceUrl: 'https://example.org/item/1',
    language: 'ar',
    rights: 'ALLOWED',
    provenance: { provider: 'example', method: 'catalogue' },
    retrievalDate: '2026-09-15',
    contentHash: 'sha256:test',
    publishable: true,
  });
  assert.equal(validateWorldwideResource(resource).valid, true);
  assert.equal(resource.publishable, true);
});

test('unknown/restricted rights can be catalogued but cannot become publishable', () => {
  const registry = createWorldwideResourceRegistry();
  const resource = registerWorldwideResource(registry, {
    resourceId: 'source:restricted:1',
    resourceType: 'BOOK_PDF',
    title: 'Restricted work',
    sourceUrl: 'https://example.org/restricted/1',
    language: 'ar',
    rights: 'RESTRICTED',
    provenance: { provider: 'example' },
    retrievalDate: '2026-09-15',
    publishable: true,
  });
  assert.equal(resource.publishable, false);
  assert.equal(validateWorldwideResource(resource).valid, false);
});

test('engines can depend on registered resources and the audit detects missing registrations', () => {
  const registry = createWorldwideResourceRegistry();
  registerEngineResource(registry, {
    engineId: 'V9_MULTIMODAL_ISLAMIC_LEARNING',
    stageId: 'V9',
    version: '9.0.0',
    status: 'IMPLEMENTED_FOUNDATION',
    sourceResourceIds: ['source:missing:1'],
  });
  const blocked = buildWorldwideResourceAudit(registry);
  assert.equal(blocked.enginesValid, false);
  assert.equal(blocked.complete, false);

  registerWorldwideResource(registry, {
    resourceId: 'source:missing:1',
    resourceType: 'IIIF',
    title: 'IIIF source',
    sourceUrl: 'https://example.org/iiif/1',
    language: 'ar',
    rights: 'ALLOWED',
    provenance: { provider: 'example' },
    retrievalDate: '2026-09-15',
    publishable: true,
  });
  const complete = buildWorldwideResourceAudit(registry);
  assert.equal(complete.enginesValid, true);
  assert.equal(complete.complete, true);
});