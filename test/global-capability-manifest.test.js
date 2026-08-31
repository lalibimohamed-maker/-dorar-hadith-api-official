import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../config/global-capability-manifest-2026.json', import.meta.url), 'utf8'));
const renewal = JSON.parse(await readFile(new URL('../config/historical-text-renewal-2026.json', import.meta.url), 'utf8'));
const restoration = JSON.parse(await readFile(new URL('../config/research/restoration-capability-pack-2026.json', import.meta.url), 'utf8'));

test('global manifest retains the full research army', () => {
  const r = manifest.domains.research;
  for (const key of [
    'specialistSearch','queryDecomposition','parallelFanOut','officialPrimarySourceDiscovery',
    'scholarlyDiscovery','booksAndLibraries','newsAndJournals','images','audio','video',
    'documentExtraction','semanticRetrieval','reranking','knowledgeGraph','citationGraph',
    'sourceLineage','editionResolution','semanticDeduplication','negativeEvidence',
    'temporalConsistency','claimEvidenceLinking','contradictionDetection','evidenceSufficiencyGate',
    'statementExtraction','contextExpansion','statementDetailing','inferenceWithTraceability',
    'uncertaintyGate','citationBuilder'
  ]) assert.equal(r[key], true, `missing research capability: ${key}`);
});

test('global manifest retains historical-book renewal capabilities', () => {
  const b = manifest.domains.book_digitization;
  for (const key of [
    'digitalPdfClassification','scannedBookClassification','deskew','dewarp','illuminationNormalization',
    'backgroundEstimation','noiseRemoval','spotRemoval','bleedThroughSuppression','deblur','defade',
    'inkBackgroundSeparation','localContrastEnhancement','adaptiveBinarization','historicalLayoutAnalysis',
    'readingOrder','multiEngineOcr','ocrConsensus','glyphLegibilityRepair','diplomaticTranscription',
    'sourceImagePreservation','pageRegionCoordinates','questionAnswerDetection','blankMarkerLocalMasking',
    'readableTypesetRenewal','warmYellowReadingEdition','multiformatExport','visualDiff','rightsGate','originalHashStability'
  ]) assert.equal(b[key], true, `missing book capability: ${key}`);
});

test('renewal and restoration remain non-destructive', () => {
  assert.equal(renewal.separationOfConcerns.sourceImage, 'immutable');
  assert.equal(renewal.separationOfConcerns.diplomaticText, 'immutable_semantic_record');
  assert.equal(renewal.renewalRules.materialCharacterRepairRequiresEvidence, true);
  assert.equal(renewal.renewalRules.ambiguousCharacterIsNotGuessed, true);
  assert.equal(restoration.safety.restorationCannotInventGlyphs, true);
  assert.equal(restoration.safety.restorationCannotChangeDiplomaticText, true);
});
