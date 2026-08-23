import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const voice = fs.readFileSync(new URL("../web/voice.js", import.meta.url), "utf8");

// Regression guards for the complete voice contract. These are intentionally
// static because real microphone/TTS hardware is browser- and device-dependent.
test("voice input is connected to the browser recognition API", () => {
  assert.match(voice, /SpeechRecognition \\|\\| window\\.webkitSpeechRecognition/);
  assert.match(voice, /recognition\\.onresult/);
  assert.match(voice, /recognition\\.start\\(\\)/);
});

test("voice output uses the selected language and system voice", () => {
  assert.match(voice, /speechSynthesis\\.speak/);
  assert.match(voice, /languageVoices/);
  assert.match(voice, /voiceURI/);
  assert.match(voice, /utterance\\.lang/);
});

test("voice quality controls are applied to spoken responses", () => {
  assert.match(voice, /utterance\\.rate/);
  assert.match(voice, /utterance\\.pitch/);
  assert.match(voice, /utterance\\.volume/);
});

test("Quran content is explicitly blocked from generated TTS", () => {
  assert.match(voice, /QuranDomains/);
  assert.match(voice, /QuranDomains\\.has\\(domain\\)/);
  assert.match(voice, /لا تستخدم الموسوعة صوتًا توليديًا لقراءة الآية|لن تستخدم الموسوعة صوتًا توليديًا لقراءة الآية/);
});

test("voice profiles remain per-language and support multiple choices", () => {
  assert.match(voice, /deenAllahVoiceProfiles/);
  assert.match(voice, /getVoices\\(\\)/);
  assert.match(voice, /languageVoices\\(lang\\)/);
});
