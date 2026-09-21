import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createManifestRecord,
  addCanvas,
  alignPageText,
  rankManifestation,
  isPublishableManifest
} from '../src/rechercher-manuscript-iiif-intelligence-engine.js';

test('creates a provenance-gated IIIF Presentation 3.0 manifest', () => {
  const manifest = createManifestRecord({
    manifestId: 'iiif:manifest:1',
    sourceId: 'source:library:1',
    workId: 'work:book:1',
    provenance: { source: 'official repository', retrievedAt: '2026-09-14' }
  });
  assert.equal(manifest.protocol, 'PRESENTATION_3_0');
});

test('preserves page order and supports image services', () => {
  let manifest = createManifestRecord({
    manifestId: 'iiif:manifest:2', sourceId: 'source:2', workId: 'work:2',
    provenance: { source: 'archive' }
  });
  manifest = addCanvas(manifest, {
    canvasId: 'canvas:1', sequence: 1, imageService: 'iiif:image:1'
  });
  assert.equal(manifest.canvases[0].sequence, 1);
  assert.equal(manifest.canvases[0].imageService, 'iiif:image:1');
});

test('requires provenance for page text alignment', () => {
  let manifest = createManifestRecord({
    manifestId: 'iiif:manifest:3', sourceId: 'source:3', workId: 'work:3',
    provenance: { source: 'archive' }
  });
  manifest = addCanvas(manifest, { canvasId: 'canvas:1', sequence: 1 });
  assert.throws(() => alignPageText(manifest, 'canvas:1', { text: 'نص' }), /alignment provenance/);
});

test('ranks manifestations without replacing their identity', () => {
  const manifest = createManifestRecord({
    manifestId: 'iiif:manifest:4', sourceId: 'source:4', workId: 'work:4',
    provenance: { source: 'archive' }
  });
  const ranked = rankManifestation(manifest, {
    identity: true, completeness: true, imageQuality: true, textAlignment: true,
    rightsAllowed: true, authoritativeRepository: true
  });
  assert.equal(ranked.manifestId, 'iiif:manifest:4');
  assert.equal(ranked.score, 100);
});

test('unknown rights and unreviewed manifests are never publishable', () => {
  const manifest = createManifestRecord({
    manifestId: 'iiif:manifest:5', sourceId: 'source:5', workId: 'work:5',
    provenance: { source: 'archive' }, rights: 'UNKNOWN'
  });
  assert.equal(isPublishableManifest(manifest), false);
});
