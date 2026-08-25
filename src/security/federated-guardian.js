/**
 * Federated Guardian
 *
 * Deterministic policy for two owner-controlled GitHub identities working as
 * complementary defensive members of one system. The identities cooperate
 * for monitoring/evidence/recovery, but neither identity is a universal
 * recovery key for the other. This module never grants GitHub permissions
 * and never performs destructive remediation; it only produces an auditable plan.
 */

const MODES = Object.freeze(['observe', 'quarantine', 'restore', 'rebuild']);
const ENGINES = Object.freeze([
  'clamav',
  'yara',
  'trivy',
  'gitleaks',
  'dependency-audit',
  'integrity',
  'provenance'
]);

const PEER_ROLES = Object.freeze(['read-replica', 'evidence-replica', 'recovery-source']);

// Both identities are owner-controlled. Keep permissions asymmetric and
// least-privilege even though the accounts belong to the same owner.
const OWNER_IDENTITIES = Object.freeze([
  'lalibimohamed-maker',
  'lalibimohamed82-coder'
]);

export function validatePeer(peer = {}) {
  if (!peer.account || typeof peer.account !== 'string') {
    return { valid: false, reason: 'peer account is required' };
  }
  if (!OWNER_IDENTITIES.includes(peer.account)) {
    return { valid: false, reason: 'peer account is not an approved owner-controlled identity' };
  }
  if (!peer.repository || typeof peer.repository !== 'string') {
    return { valid: false, reason: 'peer repository is required' };
  }
  if (!PEER_ROLES.includes(peer.role)) {
    return { valid: false, reason: 'unsupported peer role' };
  }
  if (peer.writeAccess === true) {
    return { valid: false, reason: 'peer write access is forbidden by default' };
  }
  if (peer.canChangeSecurityPolicy === true || peer.canDeleteRecoveryData === true) {
    return { valid: false, reason: 'peer cannot independently disable security or destroy recovery data' };
  }
  return {
    valid: true,
    account: peer.account,
    repository: peer.repository,
    role: peer.role,
  };
}

export function assessSecuritySignal(signal = {}) {
  const engines = Array.isArray(signal.engines) ? signal.engines : [];
  const validEngines = engines.filter((engine) => ENGINES.includes(engine));
  const failed = validEngines.filter((engine) => signal.results?.[engine] === 'fail');
  const passed = validEngines.filter((engine) => signal.results?.[engine] === 'pass');

  if (signal.integrityCompromised === true || signal.provenanceInvalid === true) {
    return { mode: 'quarantine', reason: 'integrity-or-provenance-failure', failed, passed };
  }
  if (failed.length >= 2) {
    return { mode: 'quarantine', reason: 'multi-engine-detection', failed, passed };
  }
  if (failed.length === 1) {
    return { mode: 'observe', reason: 'single-engine-detection-requires-correlation', failed, passed };
  }
  return { mode: 'observe', reason: 'no-correlated-detection', failed, passed };
}

export function createRecoveryPlan({ signal = {}, peer = {}, checkpointAvailable = false } = {}) {
  const peerCheck = validatePeer(peer);
  if (!peerCheck.valid) return { allowed: false, reason: peerCheck.reason };

  const assessment = assessSecuritySignal(signal);
  const mode = assessment.mode;

  if (mode === 'quarantine' && !checkpointAvailable) {
    return {
      allowed: false,
      mode,
      reason: 'quarantine requires a verified checkpoint before automated restore',
      assessment,
      peer: peerCheck,
    };
  }

  return {
    allowed: true,
    mode,
    assessment,
    peer: peerCheck,
    actions: mode === 'quarantine'
      ? ['freeze-publish', 'preserve-evidence', 'verify-checkpoint', 'restore-to-isolated-state', 're-scan', 'human-approval-before-publish']
      : ['record-signal', 'correlate-results', 'continue-monitoring'],
    destructiveAutomation: false,
    auditRequired: true,
    provenanceRequired: true,
    mutualMonitoring: true,
    independentRecoveryEvidence: true,
    engines: ENGINES,
  };
}

export { MODES, ENGINES, PEER_ROLES, OWNER_IDENTITIES };
