import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCommentaryNetwork, createCommentaryRelation, registerCommentary, registerVocabularyGloss, validateHadithCommentary, validateVocabularyGloss } from '../src/hadith-commentary-network.js';

const commentary = (id = 'c1') => ({ id, hadithId: 'h1', text: 'Recorded commentary', scholar: 'Scholar', sourceId: 'src1', citation: `commentary:${id}` });
const gloss = (id = 'g1') => ({ id, commentaryId: 'c1', term: 'term', meaning: 'Recorded meaning', sourceId: 'src1', citation: `gloss:${id}` });

test('requires provenance and attribution for commentary', () => {
  assert.equal(validateHadithCommentary(commentary()).valid, true);
  assert.equal(validateHadithCommentary({ ...commentary(), scholar: '' }).valid, false);
});

test('rejects generated commentary and vocabulary', () => {
  assert.throws(() => registerCommentary(new Map(), { ...commentary(), generated: true }), /generated-content-not-allowed/);
  assert.throws(() => registerVocabularyGloss(new Map(), { ...gloss(), generated: true }), /generated-content-not-allowed/);
});

test('requires sourced vocabulary glosses', () => {
  assert.equal(validateVocabularyGloss(gloss()).valid, true);
  assert.equal(validateVocabularyGloss({ ...gloss(), sourceId: '' }).valid, false);
});

test('relations require allow-listed type and provenance', () => {
  assert.equal(createCommentaryRelation({ id: 'r1', from: 'c1', to: 'g1', type: 'defines', sourceId: 'src1', citation: '1' }).type, 'defines');
  assert.throws(() => createCommentaryRelation({ id: 'r2', from: 'c1', to: 'g1', type: 'invented', sourceId: 'src1', citation: '2' }), /Invalid commentary relation:type/);
  assert.throws(() => createCommentaryRelation({ id: 'r3', from: 'c1', to: 'g1', type: 'defines' }), /missing-provenance/);
});

test('builds a commentary network and links vocabulary to its commentary', () => {
  const graph = buildCommentaryNetwork([commentary()], [gloss()], [{ id: 'r4', from: 'c1', to: 'g1', type: 'defines', sourceId: 'src1', citation: 'gloss:g1' }]);
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.nodes.find(n => n.id === 'g1').kind, 'vocabulary');
});

test('rejects a gloss whose commentary is absent', () => {
  assert.throws(() => buildCommentaryNetwork([], [{ ...gloss(), commentaryId: 'missing' }]), /Unknown commentary/);
});
