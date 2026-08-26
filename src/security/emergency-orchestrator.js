/**
 * Emergency Security Orchestrator.
 *
 * This is a fail-closed decision engine, not an autonomous destructive agent.
 * It aggregates independent security signals and produces a deterministic
 * emergency response plan. Adapters may execute only the explicitly returned
 * safe controls; the orchestrator never grants bypass rights and never writes
 * protected content.
 */

const SEVERITY_SCORE = Object.freeze({
  informational: 0,
  warning: 10,
  error: 25,
  critical: 50,
  emergency: 100
});

const HIGH_CONFIDENCE_KINDS = new Set([
  'malware_detected',
  'secret_exposed',
  'integrity_tamper',
  'workflow_security_breach',
  'branch_protection_bypass',
  'provenance_violation',
  'rights_control_bypass',
  'artifact_tamper'
]);

const SAFE_EMERGENCY_ACTIONS = Object.freeze([
  'freeze_promotion',
  'block_release',
  'quarantine_suspect_artifact',
  'preserve_forensic_evidence',
  'request_independent_review',
  'run_read_only_rescan',
  'emit_emergency_audit_event'
]);

function normalizeSignal(signal = {}) {
  const severity = String(signal.severity ?? 'warning').toLowerCase();
  const score = SEVERITY_SCORE[severity];
  if (score === undefined) throw new TypeError(`unknown severity: ${severity}`);
  if (!signal.kind) throw new TypeError('security signal kind is required');

  return {
    kind: String(signal.kind),
    severity,
    score,
    source: String(signal.source ?? 'unknown'),
    independent: signal.independent !== false,
    trusted: signal.trusted !== false,
    message: signal.message ? String(signal.message) : null
  };
}

export function assessSecurityEmergency(signals = []) {
  if (!Array.isArray(signals)) throw new TypeError('signals must be an array');

  const normalized = signals.map(normalizeSignal);
  const trusted = normalized.filter((signal) => signal.trusted);
  const independentHigh = new Set(
    trusted
      .filter((signal) => signal.independent && signal.score >= 50)
      .map((signal) => signal.source)
  );
  const highConfidence = trusted.filter(
    (signal) => signal.score >= 50 && HIGH_CONFIDENCE_KINDS.has(signal.kind)
  );
  const independentHighCount = independentHigh.size;
  const score = Math.min(
    100,
    normalized.reduce((sum, signal) => sum + signal.score, 0)
  );

  // A single trusted, high-confidence security breach is enough for CRITICAL.
  // EMERGENCY requires either an explicit emergency signal or corroboration
  // from two independent high-severity sources. This avoids one noisy sensor
  // causing destructive automation while still failing closed on clear abuse.
  const explicitEmergency = trusted.some((signal) => signal.severity === 'emergency');
  const corroborated = independentHighCount >= 2 && highConfidence.length >= 2;
  const emergency = explicitEmergency || corroborated;
  const critical = emergency || highConfidence.length > 0 || score >= 75;

  const state = emergency ? 'EMERGENCY' : critical ? 'CRITICAL' : score >= 25 ? 'WARNING' : 'GREEN';

  const actions = state === 'GREEN'
    ? []
    : SAFE_EMERGENCY_ACTIONS.slice(0, state === 'WARNING' ? 2 : undefined);

  return Object.freeze({
    state,
    score,
    signalCount: normalized.length,
    independentHighCount,
    highConfidenceCount: highConfidence.length,
    failClosed: state !== 'GREEN',
    actions,
    signals: normalized
  });
}

export function emergencyResponsePlan(assessment) {
  if (!assessment || !['GREEN', 'WARNING', 'CRITICAL', 'EMERGENCY'].includes(assessment.state)) {
    throw new TypeError('valid security assessment is required');
  }

  return Object.freeze({
    state: assessment.state,
    promotionAllowed: assessment.state === 'GREEN',
    destructiveAutomationAllowed: false,
    requiredControls: assessment.actions,
    requireIndependentReview: assessment.state !== 'GREEN',
    preserveEvidence: assessment.state !== 'GREEN',
    quarantine: assessment.state === 'CRITICAL' || assessment.state === 'EMERGENCY',
    note: 'Emergency orchestration never bypasses protected main or governance controls.'
  });
}

export { HIGH_CONFIDENCE_KINDS, SAFE_EMERGENCY_ACTIONS };
