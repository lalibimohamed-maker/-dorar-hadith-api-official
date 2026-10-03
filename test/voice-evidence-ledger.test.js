import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateVoiceEvidence, buildVoiceEvidenceRecord } from '../src/voice-evidence-ledger.js';

test('voice evidence stays not-ready until every required runtime gate passes', () => {
  const base={
    modelId:'qwen3-asr-0.6b',
    modelVersion:'pinned',
    licenseEvidence:'Apache-2.0',
    sha256:'sha256:abc',
    backend:'local',
    deviceProfile:'cpu',
    selfTest:'passed',
    inferenceTest:'passed',
    checksumVerified:true,
    licenseReviewed:true,
  };
  const ready=evaluateVoiceEvidence(base);
  assert.equal(ready.valid,true);
  assert.equal(ready.status,'inference-verified');
  assert.deepEqual(ready.missing,[]);
  const blocked=evaluateVoiceEvidence({...base,checksumVerified:false});
  assert.equal(blocked.valid,false);
});

test('evidence record retains provenance without weakening readiness gates', () => {
  const record=buildVoiceEvidenceRecord({
    modelId:'silero-vad',
    modelVersion:'sherpa-onnx',
    licenseEvidence:'upstream-record',
    sha256:'sha256:def',
    backend:'onnxruntime',
    deviceProfile:'cpu',
    selfTest:'passed',
    inferenceTest:'passed',
    checksumVerified:true,
    licenseReviewed:true,
    provenance:'github-release',
  });
  assert.equal(record.evaluation.status,'inference-verified');
  assert.equal(record.provenance,'github-release');
});
