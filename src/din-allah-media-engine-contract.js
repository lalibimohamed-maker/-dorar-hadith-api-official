import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.join(process.cwd(), 'config/din-allah-media-engine-clean-2026.json');

export function loadMediaEngineContract() {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

export function evaluateMediaPlan(plan = {}, contract = loadMediaEngineContract()) {
  const checks = [
    ['hasBrief', Boolean(plan.brief)],
    ['hasEvidencePacket', Boolean(plan.evidencePacket)],
    ['hasStoryboard', Boolean(plan.storyboard)],
    ['hasVisualSource', Boolean(plan.visualSource)],
    ['quranTextBoundToVerifiedSource', plan.quranTextSource === 'verified_canonical_quran_source'],
    ['quranTextVerbatim', plan.quranTextMode === 'verbatim_only'],
    ['recitationIsSeparateAsset', plan.recitationMode === 'separate_rights_cleared_asset'],
    ['rightsPresent', plan.rightsStatus === 'verified'],
    ['provenancePresent', plan.provenanceStatus === 'complete'],
    ['noGeneratedQuranText', plan.generatedQuranText !== true],
    ['noGeneratedQuranRecitation', plan.generatedQuranRecitation !== true]
  ];

  const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
  return {
    ok: failed.length === 0,
    failed,
    contractVersion: contract.schemaVersion,
    engineId: contract.engineId
  };
}

export function makeDryRunPlan() {
  return {
    brief: 'A short scientific documentary scene about ants.',
    evidencePacket: { scientific: ['primary-source-record'], religious: ['quran-27-18'] },
    storyboard: [{ sceneId: 's1', durationSeconds: 6 }],
    visualSource: { kind: 'original_generation', backend: 'candidate' },
    quranTextSource: 'verified_canonical_quran_source',
    quranTextMode: 'verbatim_only',
    recitationMode: 'separate_rights_cleared_asset',
    rightsStatus: 'verified',
    provenanceStatus: 'complete',
    generatedQuranText: false,
    generatedQuranRecitation: false
  };
}
