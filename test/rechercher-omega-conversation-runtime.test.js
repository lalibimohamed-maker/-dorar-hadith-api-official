import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const runtime=JSON.parse(fs.readFileSync(path.join(root,"config/rechercher-omega-conversation-runtime-2026.json"),"utf8"));
const bridge=JSON.parse(fs.readFileSync(path.join(root,"config/rechercher-omega-media-bridge-2026.json"),"utf8"));

test("conversation runtime covers realtime dialogue end to end",()=>{
  assert.equal(runtime.pipeline.microphone,"browser-getUserMedia-or-OBS");
  assert.equal(runtime.pipeline.realtimeTransport,"WebRTC");
  assert.match(runtime.pipeline.asr,/Whisper/);
  assert.match(runtime.pipeline.translation,/MADLAD/);
  assert.match(runtime.pipeline.omega,/Rechercher Omega/);
  assert.match(runtime.pipeline.tts,/CosyVoice/);
  assert.match(runtime.pipeline.dubbing,/MuseTalk/);
});

test("conversation bridge exposes microphone, translation, voice and dubbing stages",()=>{
  const keys=["microphone_input","realtime_voice_transport","audio_cleanup","voice_activity_and_barge_in","asr","international_translation","multilingual_tts","live_voice_translation","lip_sync_dubbing","ai_media_creation"];
  for(const key of keys) assert.ok(Array.isArray(bridge.taskRouting[key]),"missing routing: "+key);
  assert.ok(bridge.taskRouting.international_translation.includes("madlad400-3b-mt"));
  assert.ok(bridge.taskRouting.international_translation.includes("opus-mt-ar-en"));
  assert.ok(bridge.taskRouting.lip_sync_dubbing.includes("musetalk"));
});

test("restricted speech-translation models cannot be promoted",()=>{
  for(const x of runtime.restrictedModels) assert.match(x.license,/NC/);
});
