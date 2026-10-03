import test from 'node:test';
import assert from 'node:assert/strict';
import { createAlHudaVoiceSession } from '../src/al-huda-voice-session.js';
import { createAudioFrontEnd } from '../src/audio-front-end.js';
import { createEndpointing } from '../src/endpointing.js';
import { createAudioFramePipeline } from '../src/audio-frame-pipeline.js';
import { createVoiceStreamRuntime } from '../src/voice-stream-runtime.js';
import { createLongFormCheckpointStore } from '../src/voice-longform-checkpoint.js';
import { renderLongFormJob } from '../src/voice-longform-runner.js';
import { createAlHudaAgentTools } from '../src/al-huda-agent-tools.js';
import { buildSpeechRequest, buildStreamingTranscriptionEndpoint, buildJsonRpcEndpoint } from '../src/voice-local-platform.js';

test('Al-Huda integrated local-first voice surface stays bounded end to end', async () => {
  const events=[];
  const stream=createVoiceStreamRuntime({onEvent:e=>events.push(e)});
  const agent=createAlHudaAgentTools({
    providers:{
      transcribe:async()=>({text:'ما حكم طلب العلم؟',language:'Arabic'}),
      synthesize:async({text})=>({audioRef:'audio://answer-1',text}),
    },
  });

  const session=createAlHudaVoiceSession({
    permission:{refresh:async()=> 'granted'},
    wakeDetector:()=>true,
    audioPipeline:createAudioFramePipeline({
      frontEnd:createAudioFrontEnd(),
      vad:samples=>Math.abs(samples[0] ?? 0)>0.01,
      endpointing:createEndpointing({startSpeechFrames:1,endSilenceFrames:1}),
    }),
    asr:async()=> (await agent.execute('transcribe',{audio:'frame-buffer'})).result,
    reasoning:async q=>`جواب موثق عن: ${q}`,
    tts:async answer=>{ await agent.execute('synthesize',{text:answer}); },
    stream,
  });

  await session.start();
  await session.pushFrame(new Float32Array([.2]));
  await session.pushFrame(new Float32Array([.2]));
  const result=await session.pushFrame(new Float32Array([0]));
  assert.equal(result.state,'answer-complete');
  assert.ok(events.some(e=>e.stream==='asr' && e.type==='final'));
  assert.ok(events.some(e=>e.stream==='tts' && e.type==='completed'));

  const checkpoints=createLongFormCheckpointStore();
  const rendered=await renderLongFormJob({
    jobId:'integration-1',
    manifestHash:'sha256:integration',
    chunks:['one','two'],
    checkpointStore:checkpoints,
    renderChunk:async chunk=>`release://${chunk}`,
  });
  assert.equal(rendered.completed,true);
  assert.equal(buildSpeechRequest({text:'test'}).json.stream_format,'audio');
  assert.match(buildStreamingTranscriptionEndpoint(),/\/v1\/audio\/transcriptions\/stream$/);
  assert.equal(buildJsonRpcEndpoint(),'http://127.0.0.1:3902/rpc');
});
