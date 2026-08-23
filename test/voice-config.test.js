import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const voice = fs.readFileSync(new URL("../web/voice.js", import.meta.url), "utf8");

test("voice layer exposes per-language profiles and multiple system voices", () => {
  assert.match(voice, /deenAllahVoiceProfiles/);
  assert.match(voice, /languageVoices/);
  assert.match(voice, /speechSynthesis\.getVoices/);
  assert.match(voice, /voiceURI/);
  assert.match(voice, /gender/);
});

test("voice layer supports microphone speech recognition when the browser exposes it", () => {
  assert.match(voice, /SpeechRecognition \|\| window\.webkitSpeechRecognition/);
  assert.match(voice, /recognition\.lang = baseLang\(\)/);
  assert.match(voice, /recognition\.start\(\)/);
});

test("Quran domains are blocked from generated text-to-speech", () => {
  assert.match(voice, /QuranDomains/);
  assert.match(voice, /QuranDomains\.has\(domain\)/);
  assert.match(voice, /لن تستخدم الموسوعة صوتًا توليديًا لقراءة الآية/);
});

test("voice quality controls are persisted per language", () => {
  assert.match(voice, /rate/);
  assert.match(voice, /pitch/);
  assert.match(voice, /volume/);
  assert.match(voice, /saveProfile\(lang\.value/);
});
