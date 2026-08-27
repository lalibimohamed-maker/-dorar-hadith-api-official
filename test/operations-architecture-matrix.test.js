import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const matrixPath = path.join(root, 'config/operations-architecture-matrix-2026.json');

test('operations architecture matrix is valid and fail-closed', () => {
  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  assert.equal(matrix.principles.failClosed, true);
  assert.equal(matrix.principles.noSilentContentPromotion, true);
  assert.equal(matrix.principles.noDestructiveAutonomousResponse, true);
  assert.equal(matrix.principles.verifyBeforeRestore, true);
  assert.equal(matrix.principles.updatesRequireProtectedPR, true);
});

test('security and recovery capabilities are represented', () => {
  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  const ids = new Set(matrix.capabilities.map((entry) => entry.id));
  for (const required of [
    'malware-detection',
    'file-integrity-and-recovery',
    'download-and-ingestion',
    'media-processing',
    'ocr-and-document-processing',
    'storage-and-cache',
    'supply-chain',
    'runtime-observability',
    'orchestration-and-compute'
  ]) {
    assert.equal(ids.has(required), true, `missing capability ${required}`);
  }
});

test('optional tools are not falsely represented as installed', () => {
  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  const byId = new Map(matrix.capabilities.map((entry) => [entry.id, entry]));
  assert.equal(byId.get('file-integrity-and-recovery').status, 'candidate-until-deployment-evidence-exists');
  assert.equal(byId.get('runtime-observability').status, 'optional-external-deployment');
  assert.equal(byId.get('media-processing').status, 'candidate-until-workflow-evidence-exists');
});

test('self-healing cannot silently mutate trusted content', () => {
  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  assert.ok(matrix.selfHealing.allowed.includes('rebuild-cache-from-verified-source'));
  for (const forbidden of [
    'write-to-trusted-corpus',
    'replace-verified-source',
    'delete-trusted-content',
    'change-security-policy',
    'change-branch-protection'
  ]) {
    assert.ok(matrix.selfHealing.requiresApprovalOrProtectedFlow.includes(forbidden));
  }
});

test('ambiguous product names are not auto-adopted', () => {
  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  const names = new Set(matrix.notApprovedAsCore.map((entry) => entry.name));
  assert.ok(names.has('SaveFrom-like-web-download-service'));
  assert.ok(names.has('uTorrent-like-client'));
  assert.ok(names.has('Unspecified-Flux-or-FSS-product'));
});
