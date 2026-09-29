import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.join(process.cwd(), 'config/din-allah-media-production-cycle-2026.json');

export function loadMediaProductionContract() {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

export function evaluateProductionPlan(plan = {}, contract = loadMediaProductionContract()) {
  const required = {
    intake: Boolean(plan.intake),
    brief: Boolean(plan.brief),
    evidence_packet: Boolean(plan.evidencePacket),
    claim_verification: plan.claimVerificationStatus === 'verified',
    script: Boolean(plan.script),
    storyboard: Boolean(plan.storyboard),
    asset_plan: Boolean(plan.assetPlan),
    rights_and_license_gate: plan.rightsStatus === 'verified',
    asset_ingest: Boolean(plan.assetIngested),
    malware_and_integrity_scan: plan.integrityStatus === 'verified',
    semantic_scene_composition: Boolean(plan.timeline),
    captions_and_accessibility: plan.accessibilityStatus === 'passed',
    audio_mix_and_master: plan.audioStatus === 'passed',
    visual_quality_control: plan.visualStatus === 'passed',
    scientific_and_religious_fidelity_check: plan.fidelityStatus === 'passed',
    provenance_manifest: plan.provenanceStatus === 'complete',
    publication_gate: plan.humanReview === 'approved' && plan.ciStatus === 'passed',
    quran_integrity: plan.quranTextMode === 'verbatim_only' &&
      plan.quranTextSource === 'verified_canonical_quran_source' &&
      plan.generatedQuranText !== true &&
      plan.generatedQuranRecitation !== true
  };
  const failed = Object.entries(required).filter(([, ok]) => !ok).map(([name]) => name);
  return {
    ok: failed.length === 0,
    failed,
    lifecycle: contract.lifecycle,
    contractVersion: contract.schemaVersion,
    engineId: contract.engineId
  };
}

export function makeDryRunProductionPlan() {
  return {
    intake: { requestId: 'dry-run' },
    brief: 'Educational scientific-religious media item.',
    evidencePacket: { sources: ['verified-source-1'] },
    claimVerificationStatus: 'verified',
    script: { version: 1 },
    storyboard: [{ sceneId: 's1', durationSeconds: 8 }],
    assetPlan: [{ assetId: 'a1', kind: 'original_generated' }],
    rightsStatus: 'verified',
    assetIngested: true,
    integrityStatus: 'verified',
    timeline: { version: 1 },
    accessibilityStatus: 'passed',
    audioStatus: 'passed',
    visualStatus: 'passed',
    fidelityStatus: 'passed',
    provenanceStatus: 'complete',
    quranTextMode: 'verbatim_only',
    quranTextSource: 'verified_canonical_quran_source',
    generatedQuranText: false,
    generatedQuranRecitation: false,
    humanReview: 'approved',
    ciStatus: 'passed'
  };
}
