import test from 'node:test';
import assert from 'node:assert/strict';
import { assessSecurityEmergency, emergencyResponsePlan } from '../src/security/emergency-orchestrator.js';

test('green when no security signals exist', () => {
  const assessment = assessSecurityEmergency([]);
  assert.equal(assessment.state, 'GREEN');
  assert.equal(assessment.failClosed, false);
  assert.deepEqual(assessment.actions, []);
});

test('signal trust and independence must be explicit', () => {
  assert.throws(
    () => assessSecurityEmergency([{ kind: 'workflow_anomaly', severity: 'warning', source: 'workflow-integrity' }]),
    /trust must be explicit/
  );
  assert.throws(
    () => assessSecurityEmergency([{ kind: 'workflow_anomaly', severity: 'warning', source: 'workflow-integrity', trusted: true }]),
    /independence must be explicit/
  );
});

test('warning freezes promotion without destructive response', () => {
  const assessment = assessSecurityEmergency([
    { kind: 'workflow_anomaly', severity: 'warning', source: 'workflow-integrity', trusted: true, independent: true }
  ]);
  const plan = emergencyResponsePlan(assessment);
  assert.equal(assessment.state, 'WARNING');
  assert.equal(assessment.failClosed, true);
  assert.equal(plan.promotionAllowed, false);
  assert.equal(plan.destructiveAutomationAllowed, false);
  assert.equal(plan.requireIndependentReview, true);
  assert.equal(plan.quarantine, false);
});

test('one trusted malware signal raises critical state', () => {
  const assessment = assessSecurityEmergency([
    { kind: 'malware_detected', severity: 'critical', source: 'clamav', trusted: true, independent: true }
  ]);
  assert.equal(assessment.state, 'CRITICAL');
  const plan = emergencyResponsePlan(assessment);
  assert.equal(plan.promotionAllowed, false);
  assert.equal(plan.quarantine, true);
  assert.equal(plan.requireIndependentReview, true);
});

test('two independent high-confidence sensors trigger emergency', () => {
  const assessment = assessSecurityEmergency([
    { kind: 'malware_detected', severity: 'critical', source: 'clamav', trusted: true, independent: true },
    { kind: 'artifact_tamper', severity: 'critical', source: 'integrity', trusted: true, independent: true }
  ]);
  assert.equal(assessment.state, 'EMERGENCY');
  assert.equal(assessment.independentHighCount, 2);
  const plan = emergencyResponsePlan(assessment);
  assert.equal(plan.promotionAllowed, false);
  assert.equal(plan.quarantine, true);
  assert.equal(plan.preserveEvidence, true);
});

test('explicit emergency signal triggers emergency immediately', () => {
  const assessment = assessSecurityEmergency([
    { kind: 'workflow_security_breach', severity: 'emergency', source: 'workflow-security', trusted: true, independent: false }
  ]);
  assert.equal(assessment.state, 'EMERGENCY');
});

test('untrusted signals cannot independently trigger emergency or raise score', () => {
  const assessment = assessSecurityEmergency([
    { kind: 'malware_detected', severity: 'critical', source: 'untrusted-feed', trusted: false, independent: true },
    { kind: 'workflow_anomaly', severity: 'warning', source: 'monitor', trusted: false, independent: true }
  ]);
  assert.equal(assessment.state, 'GREEN');
  assert.equal(assessment.score, 0);
  assert.equal(assessment.failClosed, false);
});

test('untrusted telemetry cannot corroborate trusted high-severity signals', () => {
  const assessment = assessSecurityEmergency([
    { kind: 'malware_detected', severity: 'critical', source: 'clamav', trusted: true, independent: true },
    { kind: 'artifact_tamper', severity: 'critical', source: 'untrusted-integrity', trusted: false, independent: true }
  ]);
  assert.equal(assessment.state, 'CRITICAL');
  assert.equal(assessment.independentHighCount, 1);
});

test('emergency plan never grants bypass or destructive automation', () => {
  const assessment = assessSecurityEmergency([
    { kind: 'secret_exposed', severity: 'emergency', source: 'secret-scan', trusted: true, independent: true }
  ]);
  const plan = emergencyResponsePlan(assessment);
  assert.equal(plan.destructiveAutomationAllowed, false);
  assert.match(plan.note, /never bypasses protected main/);
});
