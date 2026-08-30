import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const cfg = JSON.parse(fs.readFileSync(new URL('../config/historical-book-reconstruction-engine-2026.json', import.meta.url), 'utf8'));

test('historical reconstruction preserves the diplomatic source', () => {
  assert.equal(cfg.editionModel.preserveDiplomaticImage, true);
  assert.equal(cfg.editionModel.preserveDiplomaticTranscription, true);
  assert.equal(cfg.editionModel.originalTextContentMustRemainSemanticallyUnchanged, true);
  assert.equal(cfg.editionModel.neverInventMissingWords, true);
});

test('damaged glyph repair is separated from textual reconstruction', () => {
  assert.equal(cfg.editionModel.glyphRepairMayOnlyRepairLegibility, true);
  assert.equal(cfg.editionModel.uncertainGlyphRepairMustBeMarked, true);
  assert.match(cfg.repairPolicy.level3_textual_reconstruction, /independent textual evidence/);
  assert.match(cfg.repairPolicy.ambiguous_result, /preserve original mark/);
});

test('free-first outputs include common archival formats', () => {
  assert.equal(cfg.freeFirst, true);
  assert.equal(cfg.noPaidDependencyRequired, true);
  for (const format of ['facsimile-preserved-pdf','readable-yellow-paper-pdf','searchable-pdf','docx','pptx','epub','html','page-xml','alto-xml','tei-xml']) {
    assert.ok(cfg.outputEditions.includes(format), `missing output: ${format}`);
  }
});

test('yellow paper is a derived edition and never changes source images', () => {
  assert.equal(cfg.yellowPaperEdition.enabled, true);
  assert.equal(cfg.yellowPaperEdition.neverApplyToSourceImages, true);
  assert.equal(cfg.yellowPaperEdition.recordTransformationMetadata, true);
});
