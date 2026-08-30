import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProcessingPlan, discoverCandidateEngine } from '../src/media/engine-mesh.mjs';

test('builds a unified open-ended high-resolution video plan', () => {
  const plan = buildProcessingPlan({
    source: { isNative: true, nativeVerified: true, needsRestoration: true },
    target: '24K',
    evidence: { sourceGeometryVerified: true },
  });
  assert.equal(plan.target, '24K');
  assert.equal(plan.claims.native24K, true);
  assert.equal(plan.claims.derived24K, false);
  assert.ok(plan.stages.some((stage) => stage.stage === 'spatial-super-resolution'));
  assert.ok(plan.stages.some((stage) => stage.stage === 'temporal-consistency'));
  assert.ok(plan.stages.some((stage) => stage.stage === 'color-and-hdr-preservation'));
  assert.ok(plan.stages.some((stage) => stage.stage === 'checksum-and-lineage'));
});

test('refuses native-24K claim for unverified source geometry', () => {
  const plan = buildProcessingPlan({ source: { isNative: false }, target: '24K' });
  assert.equal(plan.claims.native24K, false);
  assert.equal(plan.claims.derived24K, true);
  assert.ok(plan.warnings.some((warning) => warning.includes('24K-output-must-be-labelled-derived')));
});

test('future engine discovery starts disabled', () => {
  const candidate = discoverCandidateEngine({ name: 'FutureSR' });
  assert.equal(candidate.state, 'discovered');
  assert.equal(candidate.enabled, false);
  assert.deepEqual(candidate.nextStates, ['audited', 'benchmarking', 'approved', 'enabled']);
});

test('interpolation is explicitly optional and never treated as native capture', () => {
  const plan = buildProcessingPlan({ source: { allowFrameInterpolation: true }, target: '16K' });
  assert.ok(plan.stages.some((stage) => stage.stage === 'frame-interpolation-optional'));
  assert.ok(plan.warnings.some((warning) => warning.includes('frame-interpolation-changes-temporal-sampling')));
});
