import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const cfg = JSON.parse(fs.readFileSync(new URL('../config/derived-edition-export-2026.json', import.meta.url), 'utf8'));

test('derived editions provide free-first document outputs', () => {
  assert.equal(cfg.freeFirst, true);
  assert.equal(cfg.noPaidDependencyRequired, true);
  for (const key of ['pdf','docx','pptx','epub','html','txt','markdown','pageXml','altoXml','teiXml','ocrJson']) {
    assert.ok(cfg.formats[key], `missing export format ${key}`);
  }
});

test('exports retain provenance and uncertainty', () => {
  assert.equal(cfg.conversionRules.retainPageAndRegionProvenance, true);
  assert.equal(cfg.conversionRules.retainUncertaintyAnnotations, true);
  assert.equal(cfg.conversionRules.retainEditionIdentity, true);
  assert.equal(cfg.conversionRules.lossyConversionRequiresExplicitOptIn, true);
});
