import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFallbackCycle, selectEngine } from '../src/free-first-fallback.js';

test('preferred engine wins when healthy and current', () => {
  const result = selectEngine('malware', {
    clamav: { available: true, healthy: true, compatible: true, current: true, free: true, openSource: true, qualityScore: 95 }
  });
  assert.equal(result.selected, 'clamav');
  assert.equal(result.reason, 'preferred-engine-healthy');
});

test('free fallback is selected when the preferred engine is unavailable', () => {
  const result = selectEngine('malware', {
    clamav: { available: false, free: true },
    'yara-forge-core': { available: true, healthy: true, compatible: true, current: true, free: true, openSource: true, qualityScore: 90 }
  });
  assert.equal(result.selected, 'yara-forge-core');
  assert.equal(result.reason, 'fallback-selected');
  assert.equal(result.fallbackDepth, 1);
});

test('the selector fails closed when no free eligible engine remains', () => {
  const result = selectEngine('secrets', {
    gitleaks: { available: false, free: true },
  });
  assert.equal(result.selected, null);
  assert.equal(result.failClosed, true);
});

test('unknown or incomplete engine status is not eligible', () => {
  const result = selectEngine('malware', {});
  assert.equal(result.selected, null);
  assert.equal(result.failClosed, true);
});

test('unhealthy or incompatible fallbacks are not eligible', () => {
  const result = selectEngine('malware', {
    clamav: { available: false, free: true },
    'yara-forge-core': { available: true, healthy: false, compatible: true, current: true, free: true }
  });
  assert.equal(result.selected, null);
  assert.equal(result.failClosed, true);
});


test('fallback cycle records version, fallback reason, evidence, and scholarly gate', () => {
  const result = evaluateFallbackCycle('malware', {
    clamav: {
      available: false,
      healthy: false,
      compatible: true,
      current: true,
      free: true,
      version: '1.4.0',
      assuranceScore: 95
    },
    'yara-forge-core': {
      available: true,
      healthy: true,
      compatible: true,
      current: true,
      free: true,
      openSource: true,
      version: '1.0.0',
      capabilityScore: 90,
      qualityScore: 92,
      freshnessScore: 95,
      assuranceScore: 95,
      securityAssurance: 'verified',
      scientificAssurance: 'unchanged'
    }
  });
  assert.equal(result.selected, 'yara-forge-core');
  assert.equal(result.reasonForFallback, 'unavailable');
  assert.equal(result.cycle.selectedVersion, '1.0.0');
  assert.equal(result.cycle.fallbackUsed, true);
  assert.equal(result.automaticScholarlyPromotionAllowed, false);
  assert.ok(result.evidence[0].version);
});

test('a fallback with lower assurance than the preferred engine is not selected', () => {
  const result = evaluateFallbackCycle('malware', {
    clamav: {
      available: false,
      healthy: false,
      compatible: true,
      current: true,
      free: true,
      assuranceScore: 99
    },
    'yara-forge-core': {
      available: true,
      healthy: true,
      compatible: true,
      current: true,
      free: true,
      qualityScore: 100,
      assuranceScore: 80
    }
  });
  assert.equal(result.selected, null);
  assert.equal(result.failClosed, true);
});
