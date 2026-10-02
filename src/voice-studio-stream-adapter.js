const PROTOCOL = "voicestudio.speech.v1";

function parseMessage(message) {
  if (typeof message === "string") {
    try {
      return JSON.parse(message);
    } catch {
      throw new Error("invalid VoiceStudio stream JSON");
    }
  }
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    throw new TypeError("VoiceStudio stream message must be an object or JSON string");
  }
  return message;
}

function assertEnvelope(event) {
  if (event.protocol !== PROTOCOL) throw new Error("unsupported VoiceStudio stream protocol");
  if (!event.session_id) throw new Error("VoiceStudio stream session_id is required");
  if (!event.type) throw new Error("VoiceStudio stream type is required");
}

export function createVoiceStudioStreamAdapter({ runtime, sessionId = null } = {}) {
  if (!runtime || typeof runtime.startASR !== "function") {
    throw new TypeError("runtime with ASR stream methods is required");
  }
  let activeSessionId = sessionId;

  function consume(message) {
    const event = parseMessage(message);
    assertEnvelope(event);

    if (activeSessionId && event.session_id !== activeSessionId) {
      throw new Error("VoiceStudio stream session mismatch");
    }
    activeSessionId ||= String(event.session_id);

    if (event.type === "session.started") {
      return runtime.startASR({
        sessionId: activeSessionId,
        protocol: PROTOCOL,
      });
    }

    if (event.type === "partial") {
      const text = String(event.text ?? "").trim();
      if (!text) throw new Error("VoiceStudio partial text must not be empty");
      return runtime.partialASR(text, {
        sessionId: activeSessionId,
        protocol: PROTOCOL,
        finalKind: event.final_kind || null,
      });
    }

    if (event.type === "final") {
      const text = String(event.text ?? "").trim();
      if (!text) throw new Error("VoiceStudio final text must not be empty");
      return runtime.finalASR(text, {
        sessionId: activeSessionId,
        protocol: PROTOCOL,
        finalKind: event.final_kind || null,
      });
    }

    if (event.type === "error") {
      return runtime.failASR(event.message || event.error || "VoiceStudio stream error", {
        sessionId: activeSessionId,
        protocol: PROTOCOL,
      });
    }

    return Object.freeze({
      ignored: true,
      type: event.type,
      sessionId: activeSessionId,
    });
  }

  return Object.freeze({
    protocol: PROTOCOL,
    get sessionId() { return activeSessionId; },
    consume,
  });
}
