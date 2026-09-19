import test from 'node:test';
import assert from 'node:assert/strict';
import { createIiifConnector, parseIiifManifest, extractPdfRenderings } from '../src/rechercher-iiif-connector.js';

const manifest = {
  id: 'https://example.org/iiif/book/manifest', type: 'Manifest',
  label: { en: ['Example book'] },
  rendering: [{ id: 'https://example.org/files/book.pdf', type: 'Text', format: 'application/pdf' }],
  items: [{ id: 'https://example.org/canvas/1', type: 'Canvas', width: 1000, height: 1500,
    items: [{ items: [{ body: { id: 'https://example.org/page/1.jpg', type: 'Image', format: 'image/jpeg' } }] }] }],
};

test('IIIF manifest parser exposes canvases and PDF renderings', () => {
  const model = parseIiifManifest(manifest);
  assert.equal(model.canvases.length, 1);
  assert.equal(extractPdfRenderings(model).length, 1);
});

test('IIIF connector fetches a manifest without bypassing access controls', async () => {
  const connector = createIiifConnector({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => manifest }) });
  const result = await connector.fetchManifest(manifest.id);
  assert.equal(result.pdfRenderings[0].format, 'application/pdf');
  assert.equal(connector.policy.noAccessControlBypass, true);
  const candidate = connector.createAcquisitionCandidate(result, { sourceId: 'iiif-test', rightsStatus: 'UNKNOWN', provenance: { source: manifest.id } });
  assert.equal(candidate.publishable, false);
  assert.equal(candidate.acquisitionIndependentFromPublication, true);
});

test('IIIF connector exposes Content Search results', async () => {
  const connector = createIiifConnector({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ items: [{ id: 'https://example.org/anno/1', type: 'AnnotationPage' }] }) }) });
  const result = await connector.searchContent('https://example.org/iiif/book/manifest/search?q=العلم');
  assert.equal(result.hits.length, 1);
});
