import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getIllustratedKnowledgeCard,
  filterMediaOutOfEncyclopediaSearch,
  loadIllustrationCatalog
} from '../src/scientific-religious-illustration-catalog.js';

test('ant knowledge card contains Quran, science and relevant illustrations', () => {
  const catalog = loadIllustrationCatalog();
  const card = getIllustratedKnowledgeCard('quran-ant-27-18', catalog);
  assert.ok(card);
  assert.equal(card.quranReferences[0].reference, '27:18');
  assert.equal(card.knowledgeClaims[0].claimClass, 'scientific_observation');
  assert.ok(card.illustrations.length >= 3);
  assert.ok(card.illustrations.every(image => image.role === 'illustration_for_knowledge'));
  assert.ok(card.illustrations.every(image => image.isScientificEvidence === false));
});

test('encyclopedia search excludes video/audio result types', () => {
  const results = [
    { type: 'article', title: 'النمل في القرآن' },
    { type: 'video', title: 'Ant documentary' },
    { mediaType: 'audio', title: 'Recitation' },
    { category: 'scientific_video', title: 'Ant science video' },
    { type: 'paper', title: 'Ant communication study' }
  ];
  const filtered = filterMediaOutOfEncyclopediaSearch(results);
  assert.deepEqual(filtered.map(x => x.title), ['النمل في القرآن', 'Ant communication study']);
});
