const KINDS = Object.freeze({
  asr: new Set(["started","partial","final","completed","failed"]),
  tts: new Set(["started","chunk","completed","failed"]),
});

export function createVoiceStreamRuntime({ onEvent = () => {} } = {}) {
  let sequence = 0;
  let asrState = "idle";
  let ttsState = "idle";

  function emit(stream, kind, payload = {}) {
    if (!KINDS[stream]?.has(kind)) {
      throw new Error(`unsupported ${stream} event: ${kind}`);
    }
    const stateKey = stream === "asr" ? "asrState" : "ttsState";
    const current = stream === "asr" ? asrState : ttsState;
    const terminal = new Set(["completed", "failed"]);
    if (kind === "started" && (current === "completed" || current === "failed")) {
      if (stream === "asr") asrState = "idle";
      else ttsState = "idle";
    }
    const activeCurrent = stream === "asr" ? asrState : ttsState;
    if (activeCurrent === "completed" || activeCurrent === "failed") {
      throw new Error(`${stream} stream already terminated`);
    }
    if (kind === "started" && activeCurrent !== "idle") {
      throw new Error(`${stream} stream already started`);
    }
    if (kind === "partial" && stream === "asr" && current !== "started" && current !== "partial") {
      throw new Error("ASR partial requires started state");
    }
    if (kind === "final" && stream === "asr" && current !== "started" && current !== "partial" && current !== "final") {
      throw new Error("ASR final requires an active stream");
    }
    if (kind === "chunk" && stream === "tts" && current !== "started") {
      throw new Error("TTS chunk requires started state");
    }

    sequence += 1;
    const event = Object.freeze({
      protocol: "dinullah.voice-stream.v1",
      sequence,
      stream,
      type: kind,
      ...payload,
    });
    if (stream === "asr") asrState = kind;
    else ttsState = kind;
    onEvent(event);
    return event;
  }

  return Object.freeze({
    startASR(meta = {}) { return emit("asr", "started", meta); },
    partialASR(text, meta = {}) {
      const value = String(text ?? "").trim();
      if (!value) throw new Error("ASR partial text must not be empty");
      return emit("asr", "partial", { text: value, ...meta });
    },
    finalASR(text, meta = {}) {
      const value = String(text ?? "").trim();
      if (!value) throw new Error("ASR final text must not be empty");
      return emit("asr", "final", { text: value, ...meta });
    },
    completeASR(meta = {}) { return emit("asr", "completed", meta); },
    failASR(error, meta = {}) {
      return emit("asr", "failed", { error: String(error?.message || error || "unknown"), ...meta });
    },
    startTTS(meta = {}) { return emit("tts", "started", meta); },
    chunkTTS(audioRef, meta = {}) {
      if (!audioRef) throw new Error("TTS chunk audioRef is required");
      return emit("tts", "chunk", { audioRef: String(audioRef), ...meta });
    },
    completeTTS(meta = {}) { return emit("tts", "completed", meta); },
    failTTS(error, meta = {}) {
      return emit("tts", "failed", { error: String(error?.message || error || "unknown"), ...meta });
    },
    get sequence() { return sequence; },
    get state() { return Object.freeze({ asr: asrState, tts: ttsState }); },
  });
}
