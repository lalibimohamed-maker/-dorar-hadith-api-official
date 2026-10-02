import test from "node:test";
import assert from "node:assert/strict";
import { createVoiceStreamRuntime } from "../src/voice-stream-runtime.js";
import { createVoiceStudioStreamAdapter } from "../src/voice-studio-stream-adapter.js";

test("VoiceStudio stream adapter maps documented session, partial and final envelopes", () => {
  const events = [];
  const runtime = createVoiceStreamRuntime({ onEvent: event => events.push(event) });
  const bridge = createVoiceStudioStreamAdapter({ runtime });

  bridge.consume(JSON.stringify({
    protocol: "voicestudio.speech.v1",
    session_id: "s1",
    type: "session.started",
  }));
  bridge.consume({
    protocol: "voicestudio.speech.v1",
    session_id: "s1",
    type: "partial",
    text: "hello wor",
  });
  bridge.consume({
    protocol: "voicestudio.speech.v1",
    session_id: "s1",
    type: "final",
    final_kind: "summary",
    text: "Hello world.",
  });

  assert.equal(bridge.sessionId, "s1");
  assert.deepEqual(
    events.map(event => [event.stream, event.type, event.text || null]),
    [["asr", "started", null], ["asr", "partial", "hello wor"], ["asr", "final", "Hello world."]]
  );
  assert.equal(events.at(-1).finalKind, "summary");
  assert.equal(runtime.sequence, 3);
});

test("VoiceStudio stream adapter rejects protocol and session mismatches", () => {
  const runtime = createVoiceStreamRuntime();
  const bridge = createVoiceStudioStreamAdapter({ runtime, sessionId: "fixed" });

  assert.throws(() => bridge.consume({
    protocol: "other.v1",
    session_id: "fixed",
    type: "partial",
    text: "x",
  }), /unsupported VoiceStudio stream protocol/);

  assert.throws(() => bridge.consume({
    protocol: "voicestudio.speech.v1",
    session_id: "other",
    type: "partial",
    text: "x",
  }), /session mismatch/);
});

test("VoiceStudio stream adapter rejects empty partial/final text", () => {
  const runtime = createVoiceStreamRuntime();
  const bridge = createVoiceStudioStreamAdapter({ runtime });

  bridge.consume({
    protocol: "voicestudio.speech.v1",
    session_id: "s1",
    type: "session.started",
  });

  assert.throws(() => bridge.consume({
    protocol: "voicestudio.speech.v1",
    session_id: "s1",
    type: "partial",
    text: "   ",
  }), /partial text must not be empty/);

  assert.throws(() => bridge.consume({
    protocol: "voicestudio.speech.v1",
    session_id: "s1",
    type: "final",
    text: "",
  }), /final text must not be empty/);
});

test("VoiceStudio stream adapter fails ASR on an explicit error envelope", () => {
  const events = [];
  const runtime = createVoiceStreamRuntime({ onEvent: event => events.push(event) });
  const bridge = createVoiceStudioStreamAdapter({ runtime });

  bridge.consume({
    protocol: "voicestudio.speech.v1",
    session_id: "s1",
    type: "session.started",
  });
  bridge.consume({
    protocol: "voicestudio.speech.v1",
    session_id: "s1",
    type: "error",
    message: "decoder failed",
  });

  assert.equal(events.at(-1).type, "failed");
  assert.equal(events.at(-1).error, "decoder failed");
});

test("VoiceStudio bridge routes local audio through the Al-Huda Qwen3 runtime", async () => {
  const events = [];
  const runtime = createVoiceStreamRuntime({ onEvent: event => events.push(event) });
  const bridge = createVoiceStudioStreamAdapter({
    runtime,
    localASR: {
      engine: { id: "qwen3-asr-0.6b" },
      transcribe: async ({ audioPath, language }) => {
        assert.equal(audioPath, "/tmp/question.wav");
        assert.equal(language, "ar");
        return { text: "ما هو الوضوء؟", language: "ar" };
      },
    },
  });

  const result = await bridge.transcribeAudio({
    audioPath: "/tmp/question.wav",
    language: "ar",
    sessionId: "local-1",
  });

  assert.equal(result.text, "ما هو الوضوء؟");
  assert.equal(result.engine, "qwen3-asr-0.6b");
  assert.equal(result.sessionId, "local-1");
  assert.deepEqual(
    events.map(event => event.type),
    ["started", "final", "completed"]
  );
  assert.equal(events[1].backend, undefined);
});

test("VoiceStudio bridge records a failed local ASR run and does not fabricate text", async () => {
  const events = [];
  const runtime = createVoiceStreamRuntime({ onEvent: event => events.push(event) });
  const bridge = createVoiceStudioStreamAdapter({
    runtime,
    localASR: {
      engine: { id: "qwen3-asr-1.7b" },
      transcribe: async () => ({ text: "   " }),
    },
  });

  await assert.rejects(
    () => bridge.transcribeAudio({ audioPath: "/tmp/empty.wav", sessionId: "local-2" }),
    /empty transcript/
  );
  assert.equal(events.at(-1).type, "failed");
});
