import test from 'node:test';
import assert from 'node:assert/strict';
import { assessSecurityEmergency, emergencyResponsePlan } from '../src/security/emergency-orchestrator.js';

test('green when no security signals exist', () => {
  const assessment = assessSecurityEmergency([]);
  assert.equal(assessment.state, 'GREEN');
  assert.equal(assessment.failClosed, false);
  assert.deepEqual(assessment.actions, []);
});

test('warning freezes promotion without destructive response', () => {
  const assessment = assessSecurityEmergency([
    { kind: 'workflow_anomaly', severity: 'warning', source: 'workflow-integrity' }
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
    { kind: 'malware_detected', severity: 'critical', source: 'clamav' }
  ]);
  assert.equal(assessment.state, 'CRITICAL');
  const plan = emergencyResponsePlan(assessment);
  assert.equal(plan.promotionAllowed, false);
  assert.equal(plan.quarantine, true);
  assert.equal(plan.requireIndependentReview, true);
});

test('two independent high-confidence sensors trigger emergency', () => {
  const assessment = assessSecurityEmergency([
    { kind: 'malware_detected', severity: 'critical', source: 'clamav' },
    { kind: 'artifact_tamper', severity: 'critical', source: 'integrity' }
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
    { kind: 'workflow_security_breach', severity: 'emergency', source: 'workflow-security' }
  ]);
  assert.equal(assessment.state, 'EMERGENCY');
});

test('untrusted signals cannot independently trigger emergency', () => {
  const assessment = assessSecurityEmergency([
    { kind: 'malware_detected', severity: 'critical', source: 'untrusted-feed', trusted: false },
    { kind: 'workflow_anomaly', severity: 'warning', source: 'monitor' }
  ]);
  assert.notEqual(assessment.state, 'EMERGENCY');
});

test('emergency plan never grants bypass or destructive automation', () => {
  const assessment = assessSecurityEmergency([
    { kind: 'secret_exposed', severity: 'emergency', source: 'secret-scan' }
  ]);
  const plan = emergencyResponsePlan(assessment);
  assert.equal(plan.destructiveAutomationAllowed, false);
  assert.match(plan.note, /never bypasses protected main/);
});
