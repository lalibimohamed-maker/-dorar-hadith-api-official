import test from 'node:test';
import assert from 'node:assert/strict';
import { createAlHudaVoiceSession } from '../src/al-huda-voice-session.js';
import { createAudioFrontEnd } from '../src/audio-front-end.js';
import { createEndpointing } from '../src/endpointing.js';
import { createAudioFramePipeline } from '../src/audio-frame-pipeline.js';

test('Al-Huda voice session wires wake detection to ASR, reasoning and TTS', async () => {
  const events=[];
  let wake=true;
  const session=createAlHudaVoiceSession({
    permission:{refresh:async()=> 'granted'},
    wakeDetector:()=>wake ? (wake=false,true) : false,
    audioPipeline:createAudioFramePipeline({
      frontEnd:createAudioFrontEnd(),
      vad:samples=>Math.abs(samples[0] ?? 0) > 0.01,
      endpointing:createEndpointing({startSpeechFrames:1,endSilenceFrames:1})
    }),
    asr:async()=>({text:'ما حكم طلب العلم؟',language:'Arabic'}),
    reasoning:async question=>`جواب موثق عن: ${question}`,
    tts:async()=>{},
    onEvent:e=>events.push(e)
  });
  await session.start();
  await session.pushFrame(new Float32Array([.1]));
  await session.pushFrame(new Float32Array([.1]));
  const result=await session.pushFrame(new Float32Array([0]));
  assert.equal(result.transcript.language,'Arabic');
  assert.match(result.answer,/طلب العلم/);
  assert.ok(events.some(e=>e.type==='wake-detected'));
  assert.ok(events.some(e=>e.type==='answer-complete'));
});

test('Al-Huda voice session interrupts active TTS', async () => {
  let release;
  const speaking=new Promise(resolve=>{release=resolve;});
  let signal;
  const session=createAlHudaVoiceSession({
    permission:{refresh:async()=> 'granted'},
    wakeDetector:()=>true,
    audioPipeline:createAudioFramePipeline({
      frontEnd:createAudioFrontEnd(),
      vad:samples=>Math.abs(samples[0] ?? 0) > 0.01,
      endpointing:createEndpointing({startSpeechFrames:1,endSilenceFrames:1})
    }),
    asr:async()=>({text:'سؤال',language:'Arabic'}),
    reasoning:async()=> 'إجابة',
    tts:async(_,s)=>{signal=s; await speaking; if(s.aborted) throw s.reason;}
  });
  await session.start();
  await session.pushFrame(new Float32Array([.1]));
  await session.pushFrame(new Float32Array([.1]));
  const p=session.pushFrame(new Float32Array([0]));
  while(!signal) await new Promise(r=>setTimeout(r,0));
  session.interrupt();
  assert.equal(signal.aborted,true);
  release();
  await assert.rejects(p);
});

test('Al-Huda does not capture speech before wake detection', async () => {
  let asrCalls=0;
  let wake=false;
  const session=createAlHudaVoiceSession({
    permission:{refresh:async()=> 'granted'},
    wakeDetector:()=>wake,
    audioPipeline:createAudioFramePipeline({
      frontEnd:createAudioFrontEnd(),
      vad:()=>true,
      endpointing:createEndpointing({startSpeechFrames:1,endSilenceFrames:1})
    }),
    asr:async()=>{asrCalls++; return {text:'unexpected',language:'Arabic'};},
    reasoning:async()=> 'unexpected',
    tts:async()=>{}
  });
  await session.start();
  await session.pushFrame(new Float32Array([.1]));
  await session.pushFrame(new Float32Array([0]));
  assert.equal(asrCalls,0);
  wake=true;
  assert.equal((await session.pushFrame(new Float32Array([.1]))).state,'wake-detected');
  assert.equal(session.armed,true);
});
