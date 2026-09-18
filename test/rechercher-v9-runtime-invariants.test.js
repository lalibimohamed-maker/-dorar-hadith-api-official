import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chunkAudioStream,
  streamAudioToPython,
  runAudioSignalPreflight,
  resolveAudioSourceFactory,
  validateCrossModalityAnchorMap,
  attachMandatoryErrorAnchors,
  lockV9CandidateStatus,
} from '../src/rechercher-v9-multimodal-learning-orchestrator.js';

test('audio is chunked without buffering a complete recording', async () => {
  const chunks = [];
  for await (const chunk of chunkAudioStream([Buffer.alloc(11), Buffer.alloc(9)], 8)) chunks.push(chunk);
  assert.deepEqual(chunks.map(chunk => chunk.length), [8, 3, 8, 1]);
  assert.ok(chunks.every(chunk => chunk.length <= 8));
});

test('zero-trust audio bridge receives only bounded chunks', async () => {
  const seen = [];
  const report = await streamAudioToPython({
    audioSource: [Buffer.alloc(20)],
    maxPayloadSize: 7,
    bridge: { processAudioChunk: async (chunk, meta) => { seen.push([chunk.length, meta.mediaOnly]); return { ok: true }; } }
  });
  assert.deepEqual(seen, [[7, true], [7, true], [6, true]]);
  assert.equal(report.totalBytes, 20);
  assert.equal(report.chunkCount, 3);
});

test('signal-quality preflight rejects low SNR before alignment', async () => {
  await assert.rejects(
    runAudioSignalPreflight({
      audioSource: [Buffer.alloc(10)],
      minSnrDb: 12,
      bridge: { analyzeSignalQuality: async (stream) => { for await (const _ of stream) {} return { snrDb: 8, accepted: false }; } }
    }),
    /SIGNAL_QUALITY_REJECTED/
  );
});

test('cross-modality anchor is mandatory for every recitation error', () => {
  const anchors = validateCrossModalityAnchorMap([{
    audioTimestamp: { startMs: 10, endMs: 20 },
    mfaTimestamp: { startMs: 10, endMs: 20 },
    canvasCoordinate: { x: 10, y: 20, w: 30, h: 40 },
    canonicalWordId: 'quran:1:1:1',
    iiifCanvasId: 'https://example.test/canvas/1'
  }]);
  const errors = attachMandatoryErrorAnchors([{ type: 'OMISSION', expected: { canonicalWordId: 'quran:1:1:1' } }], anchors);
  assert.equal(errors[0].canonicalWordId, 'quran:1:1:1');
  assert.equal(errors[0].status, 'AI_SYNTHESIS_CANDIDATE');
  assert.deepEqual(errors[0].crossModalityAnchor.canvasCoordinate, { x: 10, y: 20, w: 30, h: 40 });
  assert.throws(() => attachMandatoryErrorAnchors([{ type: 'SUBSTITUTION', expected: { canonicalWordId: 'quran:1:1:999' } }], anchors), /CROSS_MODAL_ANCHOR_MISSING/);
});

test('AI result cannot enter the public graph without an Ed25519 human-review signature', () => {
  const candidate = { type: 'TAJWEED_CANDIDATE', status: 'AI_SYNTHESIS_CANDIDATE' };
  const sandbox = lockV9CandidateStatus(candidate);
  assert.equal(sandbox.target, 'LEARNER_SANDBOX');
  assert.throws(() => lockV9CandidateStatus(candidate, { target: 'PUBLIC_KNOWLEDGE_GRAPH' }), /SIGNED_HUMAN_REVIEW_REQUIRED/);
  const verified = lockV9CandidateStatus(candidate, {
    target: 'PUBLIC_KNOWLEDGE_GRAPH',
    reviewSignature: { algorithm: 'ED25519', signature: 'signed-review', reviewerId: 'reviewer:1', state: 'VERIFIED' }
  });
  assert.equal(verified.publicGraphEligible, true);
  assert.equal(verified.automaticPromotion, false);
});


test('two-pass audio analysis requires a replayable factory for one-shot async streams', async () => {
  async function* oneShot() { yield Buffer.alloc(12); }
  assert.throws(
    () => resolveAudioSourceFactory({ audioSource: oneShot() }),
    /AUDIO_STREAM_FACTORY_REQUIRED_FOR_TWO_PASS_ANALYSIS/
  );

  let factoryCalls = 0;
  const factory = () => {
    factoryCalls += 1;
    return [Buffer.alloc(12)];
  };
  const resolved = resolveAudioSourceFactory({ audioSourceFactory: factory });
  assert.deepEqual([...resolved()], [Buffer.alloc(12)]);
  assert.equal(factoryCalls, 1);
});
