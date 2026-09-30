import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("offline_only does not use browser Web Speech recognition as a local STT claim", async () => {
  const voice = await readFile("web/voice.js", "utf8");
  assert.match(voice, /offline_only/);
  assert.match(voice, /SpeechRecognition/);
  assert.match(voice, /local STT|محلي|دون اتصال/);
  assert.match(voice, /omegaMode\(\) === "offline_only"/);
  assert.match(voice, /Web Speech غير مُستخدم/);
});
