/**
 * Algorithmic Governance Mesh
 *
 * A deterministic, auditable control plane for every processing operation.
 * It does not grant permissions by itself; adapters must enforce the returned plan.
 */

const ACTIONS = Object.freeze([
  'create', 'write', 'read', 'access', 'update', 'execute', 'design',
  'correct', 'transform', 'delete', 'publish', 'download'
]);

const NETWORKS = Object.freeze({
  processing: ['read', 'write', 'create', 'update', 'transform', 'correct', 'execute', 'design'],
  safety: ['validate', 'integrity', 'provenance', 'reversibility', 'quality-gate'],
  protection: ['least-privilege', 'input-validation', 'output-validation', 'secrets-boundary', 'rate-limit'],
  defense: ['anomaly-detection', 'tamper-detection', 'rollback', 'quarantine', 'incident-log'],
  provenance: ['source', 'license', 'transform', 'actor', 'timestamp', 'hash'],
  recovery: ['checkpoint', 'rollback', 'replay', 'idempotency']
});

const deny = (reason, controls = []) => ({ allowed: false, reason, controls });

export function evaluateOperation(request = {}) {
  const action = request.action;
  const networks = request.networks ?? Object.keys(NETWORKS);
  const evidence = request.evidence ?? {};

  if (!ACTIONS.includes(action)) {
    return deny(`unsupported action: ${String(action)}`, ['schema-validation']);
  }
  if (request.target && typeof request.target !== 'string') {
    return deny('target must be a string', ['input-validation']);
  }
  if (request.destructive && !request.rollbackAvailable) {
    return deny('destructive operation requires rollback/recovery', ['rollback', 'checkpoint']);
  }
  if (request.requiresRights && evidence.rightsVerified !== true) {
    return deny('rights have not been verified', ['license', 'provenance']);
  }
  if (request.requiresIntegrity && evidence.integrityVerified !== true) {
    return deny('integrity has not been verified', ['integrity', 'tamper-detection']);
  }

  const selectedNetworks = networks.filter((name) => NETWORKS[name]);
  return {
    allowed: true,
    action,
    networks: selectedNetworks,
    controls: [...new Set(selectedNetworks.flatMap((name) => NETWORKS[name]))],
    auditRequired: true,
    provenanceRequired: true,
    reversible: Boolean(request.rollbackAvailable),
  };
}

export function createExecutionPlan(request = {}) {
  const decision = evaluateOperation(request);
  if (!decision.allowed) return decision;

  return {
    ...decision,
    stages: [
      'authorize',
      'validate-input',
      'checkpoint',
      'execute',
      'validate-output',
      'record-provenance',
      'integrity-check',
      'audit',
      'publish-or-quarantine'
    ]
  };
}

export function listGovernanceNetworks() {
  return structuredClone(NETWORKS);
}
