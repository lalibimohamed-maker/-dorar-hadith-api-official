export const CONTRACT_VERSION = '1.0';

export function stageNumber(stageId) {
  const match = /^V(\d+)/.exec(stageId || '');
  return match ? Number(match[1]) : null;
}

export function stageClass(stageId) {
  const n = stageNumber(stageId);
  if (n === null) return 'UNKNOWN';
  if (n <= 5) return 'CORE_V1_V5';
  if (n <= 20) return 'V6_V20';
  if (n <= 30) return 'V21_V30';
  return 'V31_PLUS';
}

export function validateStageNodeContract(node) {
  const required = ['stageId','version','capabilities','acceptedInputs','producedOutputs','requiredEvidence','rightsPolicy','reviewPolicy','dependencies','handoffs'];
  for (const key of required) if (!node?.[key]) throw new TypeError(`${key} is required`);
  if (!/^\d+\.\d+$/.test(node.version)) throw new TypeError('invalid version');
  if (!Array.isArray(node.capabilities) || !node.capabilities.length) throw new TypeError('capabilities required');
  if (!Array.isArray(node.acceptedInputs) || !Array.isArray(node.producedOutputs)) throw new TypeError('input/output contracts required');
  if (!Array.isArray(node.dependencies) || !Array.isArray(node.handoffs)) throw new TypeError('dependency/handoff contracts required');
  if (!['ALLOWED','RESTRICTED','UNKNOWN','EXPLICIT_PERMISSION_REQUIRED'].includes(node.rightsPolicy.defaultState)) throw new TypeError('invalid rights state');
  const safety = node.safety || {};
  if (safety.canOverrideRights || safety.canMutateSourceIdentity || safety.canMutateContentHash || safety.canMutateCanonicalQuranArabic || safety.canMutateOriginalPdf) throw new Error('immutable safety invariant violated');
  if (stageClass(node.stageId) === 'CORE_V1_V5' && node.status !== 'IMPLEMENTED') throw new Error('core V1-V5 nodes must remain implemented');
  return true;
}

export function createStageNodeContract(input) {
  const node = {
    contractVersion: CONTRACT_VERSION,
    status: stageClass(input.stageId) === 'CORE_V1_V5' ? 'IMPLEMENTED' : 'OPEN_EXTENSION_POINT',
    safety: { canOverrideRights:false, canMutateSourceIdentity:false, canMutateContentHash:false, canMutateCanonicalQuranArabic:false, canMutateOriginalPdf:false, acquisitionIndependent:true, ...(input.safety || {}) },
    ...input
  };
  validateStageNodeContract(node);
  return Object.freeze(structuredClone(node));
}

export function assertNodeCompatibility(producer, consumer) {
  validateStageNodeContract(producer); validateStageNodeContract(consumer);
  const produced = new Set(producer.producedOutputs.map(x => x.type));
  const missing = consumer.acceptedInputs.map(x => x.type).filter(x => !produced.has(x));
  if (missing.length) throw new Error(`handoff contract mismatch: ${missing.join(',')}`);
  return true;
}
