import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const MESH_PATH = path.join(ROOT, 'config/media-engine-mesh-2026.json');
const QUALITY_PATH = path.join(ROOT, 'config/media-quality-ladder-2026.json');
const PIPELINE_PATH = path.join(ROOT, 'config/media-quality-pipeline-2026.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function loadMediaEngineMesh() {
  return readJson(MESH_PATH);
}

export function loadQualityLadder() {
  return readJson(QUALITY_PATH);
}

export function loadQualityPipeline() {
  return readJson(PIPELINE_PATH);
}

export function buildProcessingPlan({ source = {}, target = '24K', evidence = {} } = {}) {
  const mesh = loadMediaEngineMesh();
  const ladder = loadQualityLadder();
  const pipeline = loadQualityPipeline();

  if (!ladder.master || ladder.master.maxResolution !== null) {
    throw new Error('master-resolution-ceiling-must-remain-open');
  }
  if (ladder.master.upscaleLowerResolutionAsNative !== false) {
    throw new Error('native-derived-separation-required');
  }
  if (!ladder.selection.neverAdvertiseUnavailableTier) {
    throw new Error('unavailable-quality-tier-must-not-be-advertised');
  }

  const isNative = source.isNative === true || source.nativeVerified === true;
  const targetTier = ladder.preferredDownloadTiers.find((tier) => tier.label === target) ?? null;
  const requestedTarget = targetTier ? targetTier.label : target;

  const plan = {
    target: requestedTarget,
    nativeSource: isNative,
    stages: [],
    warnings: [],
    claims: {
      native24K: false,
      derived24K: false,
    },
  };

  plan.stages.push({ stage: 'quarantine-and-integrity', required: true });
  plan.stages.push({ stage: 'source-metadata-capture', required: true });
  plan.stages.push({ stage: 'rights-and-provenance-gate', required: true });

  if (source.needsRestoration) {
    plan.stages.push({ stage: 'restoration', candidates: pipeline.engines.video.concat(pipeline.engines.image) });
  }

  plan.stages.push({
    stage: 'spatial-super-resolution',
    candidates: pipeline.engines.video.filter((engine) => engine.role?.includes('video-super-resolution') || engine.role?.includes('high-resolution-reconstruction')),
  });

  plan.stages.push({
    stage: 'temporal-consistency',
    candidates: pipeline.engines.video.filter((engine) => engine.role?.includes('temporal-consistency') || engine.role?.includes('temporal-propagation')),
  });

  if (source.allowFrameInterpolation === true) {
    plan.stages.push({
      stage: 'frame-interpolation-optional',
      candidates: pipeline.engines.video.filter((engine) => engine.role?.includes('frame-interpolation')),
    });
    plan.warnings.push('frame-interpolation-changes-temporal-sampling-and-must-not-be-described-as-native-capture');
  }

  plan.stages.push({ stage: 'color-and-hdr-preservation', required: true });
  plan.stages.push({ stage: 'target-resolution-render', target: requestedTarget });
  plan.stages.push({ stage: 'objective-quality-evaluation', required: true });
  plan.stages.push({ stage: 'checksum-and-lineage', required: true });
  plan.stages.push({ stage: 'adaptive-delivery-export', required: true });

  const canClaimNativeTarget = target === '24K' && isNative && evidence.sourceGeometryVerified === true;
  if (canClaimNativeTarget) {
    plan.claims.native24K = true;
  } else if (target === '24K') {
    plan.claims.derived24K = true;
    plan.warnings.push('24K-output-must-be-labelled-derived-unless-source-geometry-is-verified-native-24K');
  }

  plan.warnings.push('engine-selection-is-evidence-gated-and-must-not-auto-enable-unverified-engines');
  plan.warnings.push(`free-first: paidApiRequired=${mesh.freeFirst.paidApiRequired}, subscriptionRequired=${mesh.freeFirst.subscriptionRequired}`);

  return plan;
}

export function discoverCandidateEngine(engine) {
  return {
    name: engine?.name ?? 'unknown',
    state: 'discovered',
    enabled: false,
    nextStates: ['audited', 'benchmarking', 'approved', 'enabled'],
    requiredEvidence: loadMediaEngineMesh().futureDiscovery.requiredEvidence,
  };
}
