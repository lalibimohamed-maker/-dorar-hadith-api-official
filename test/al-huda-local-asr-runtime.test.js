import test from "node:test";
import assert from "node:assert/strict";
import { createAlHudaLocalASRRuntime } from "../src/al-huda-local-asr-runtime.js";

test("Al-Huda local ASR selects the verified lightweight Qwen3 release", async () => {
  const calls = [];
  const runtime = createAlHudaLocalASRRuntime({
    modelPath: "./models/Qwen3-ASR-0.6B",
    modelRoot: "./models",
    lowPower: true,
    providerFactory: options => ({
      supports: capability => capability === "speech-to-text",
      execute: async input => {
        calls.push({ options, input });
        return { text: "السلام عليكم", language: "ar" };
      },
    }),
  });

  assert.equal(runtime.assistant, "Al-Huda");
  assert.equal(runtime.localFirst, true);
  assert.equal(runtime.engine.id, "qwen3-asr-0.6b");
  assert.equal(runtime.release.releaseTag, "rechercher-voice-runtime-2026-10");
  assert.equal(runtime.releaseRuntimeVerified, true);
  assert.equal(runtime.supports("speech-to-text"), true);

  const result = await runtime.transcribe({
    audioPath: "./audio/question.wav",
    language: "ar",
  });
  assert.equal(result.text, "السلام عليكم");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input.language, "ar");
});

test("Al-Huda local ASR selects the higher-quality Qwen3 release when power allows", () => {
  const runtime = createAlHudaLocalASRRuntime({
    modelPath: "/srv/dinullah/models/Qwen3-ASR-1.7B",
    providerFactory: () => ({
      supports: () => true,
      execute: async () => ({ text: "x" }),
    }),
  });

  assert.equal(runtime.engine.id, "qwen3-asr-1.7b");
  assert.equal(runtime.release.runtimeVerified, true);
});

test("Al-Huda local ASR fails closed when the installed model path escapes the approved root", () => {
  assert.throws(
    () => createAlHudaLocalASRRuntime({
      modelPath: "/srv/dinullah/other/Qwen3-ASR-0.6B",
      modelRoot: "/srv/dinullah/models",
    }),
    /outside the approved local model root/
  );
});

test("Al-Huda local ASR fails closed if the selector does not return a runtime-verified Release", () => {
  assert.throws(
    () => createAlHudaLocalASRRuntime({
      modelPath: "/srv/dinullah/models/Qwen3-ASR-0.6B",
      selector: () => ({
        engine: { id: "qwen3-asr-0.6b" },
        release: { runtimeVerified: false },
        runnable: false,
      }),
    }),
    /Release is not runtime-verified/
  );
});
