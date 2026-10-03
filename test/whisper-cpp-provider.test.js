import test from "node:test";
import assert from "node:assert/strict";
import { createWhisperCppProvider } from "../src/whisper-cpp-provider.js";

test("whisper.cpp provider exposes local multilingual speech capabilities", () => {
  const provider = createWhisperCppProvider({ modelPath: "/models/ggml-base.bin" });
  assert.equal(provider.supports("speech-to-text"), true);
  assert.equal(provider.supports("language-identification"), true);
  assert.equal(provider.supports("text-to-speech"), false);
});

test("whisper.cpp provider requires an audio path", async () => {
  const provider = createWhisperCppProvider({ modelPath: "/models/ggml-base.bin" });
  await assert.rejects(
    () => provider.execute({}),
    /audioPath is required/
  );
});
