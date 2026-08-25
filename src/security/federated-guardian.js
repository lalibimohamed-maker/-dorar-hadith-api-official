/**
 * Federated Guardian
 *
 * Deterministic policy for coordinating a primary repository with a future
 * peer repository/account. This module never grants GitHub permissions and
 * never performs destructive remediation. It only produces an auditable plan.
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

export function validatePeer(peer = {}) {
  if (!peer.repository || typeof peer.repository !== 'string') {
    return { valid: false, reason: 'peer repository is required' };
  }
  if (!PEER_ROLES.includes(peer.role)) {
    return { valid: false, reason: 'unsupported peer role' };
  }
  if (peer.writeAccess === true) {
    return { valid: false, reason: 'peer write access is forbidden by default' };
  }
  return { valid: true, repository: peer.repository, role: peer.role };
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
    engines: ENGINES,
  };
}

export { MODES, ENGINES, PEER_ROLES };
