const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export function assertVoicePlatformUrl(url, { allowRemote = false } = {}) {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("voice platform URL must use HTTP(S)");
  }
  if (!allowRemote && !LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error("remote voice platform requires explicit opt-in");
  }
  return parsed;
}

export function buildTranscriptionRequest({ baseUrl = "http://127.0.0.1:3900", audioFile, model, language, prompt, temperature, allowRemote = false } = {}) {
  if (!audioFile) throw new TypeError("audioFile is required");
  const base = assertVoicePlatformUrl(baseUrl, { allowRemote });
  const form = { model: model || "active", file: String(audioFile) };
  if (language) form.language = String(language);
  if (prompt) form.prompt = String(prompt);
  if (temperature != null) form.temperature = Number(temperature);
  return Object.freeze({ method: "POST", url: new URL("/v1/audio/transcriptions", base).toString(), form });
}

export function buildSpeechRequest({ baseUrl = "http://127.0.0.1:3900", text, model, voice, language, speed = 1, responseFormat = "wav", streamFormat = "audio", instructions, allowRemote = false } = {}) {
  if (!text) throw new TypeError("text is required");
  const allowedResponseFormats = new Set(["mp3","opus","aac","flac","wav","pcm"]);
  if (!allowedResponseFormats.has(responseFormat)) throw new Error("invalid speech response format");
  if (!["audio","sse"].includes(streamFormat)) throw new Error("invalid speech stream format");
  const base = assertVoicePlatformUrl(baseUrl, { allowRemote });
  return Object.freeze({
    method: "POST",
    url: new URL("/v1/audio/speech", base).toString(),
    json: Object.freeze({
      model: model || "active",
      input: String(text),
      voice: voice || "default",
      ...(language ? { language: String(language) } : {}),
      speed: Number(speed),
      response_format: responseFormat,
      stream_format: streamFormat,
      ...(instructions ? { instructions: String(instructions) } : {}),
    }),
  });
}

export function buildStreamingTranscriptionEndpoint({ baseUrl = "http://127.0.0.1:3900", allowRemote = false } = {}) {
  const base = assertVoicePlatformUrl(baseUrl, { allowRemote });
  const scheme = base.protocol === "https:" ? "wss:" : "ws:";
  return new URL("/v1/audio/transcriptions/stream", `${scheme}//${base.host}`).toString();
}

export function buildMcpEndpoint({ baseUrl = "http://127.0.0.1:3900", allowRemote = false } = {}) {
  const base = assertVoicePlatformUrl(baseUrl, { allowRemote });
  return new URL("/mcp/", base).toString();
}


export function buildModelsEndpoint({ baseUrl = "http://127.0.0.1:3900", allowRemote = false } = {}) {
  const base = assertVoicePlatformUrl(baseUrl, { allowRemote });
  return new URL("/v1/models", base).toString();
}

export function buildTranslationRequest({ baseUrl = "http://127.0.0.1:3900", audioFile, model, language, allowRemote = false } = {}) {
  if (!audioFile) throw new TypeError("audioFile is required");
  const base = assertVoicePlatformUrl(baseUrl, { allowRemote });
  return Object.freeze({
    method: "POST",
    url: new URL("/v1/audio/translations", base).toString(),
    form: Object.freeze({
      model: model || "active",
      file: String(audioFile),
      ...(language ? { language: String(language) } : {}),
    }),
  });
}

export function buildJsonRpcEndpoint({ baseUrl = "http://127.0.0.1:3900", allowRemote = false } = {}) {
  const base = assertVoicePlatformUrl(baseUrl, { allowRemote });
  const rpcBase = new URL(base.toString());
  rpcBase.port = "3902";
  rpcBase.pathname = "/rpc";
  rpcBase.search = "";
  return rpcBase.toString();
}

export function buildOutputSessionCreateRequest({ baseUrl = "http://127.0.0.1:3902", allowRemote = false } = {}) {
  const base = assertVoicePlatformUrl(baseUrl, { allowRemote });
  return Object.freeze({ method: "POST", url: new URL("/v1/output/sessions", base).toString() });
}

export function buildOutputSessionInsertRequest({ baseUrl = "http://127.0.0.1:3902", sessionId, text, allowRemote = false } = {}) {
  if (!sessionId) throw new TypeError("sessionId is required");
  if (!text) throw new TypeError("text is required");
  const base = assertVoicePlatformUrl(baseUrl, { allowRemote });
  return Object.freeze({
    method: "POST",
    url: new URL(`/v1/output/sessions/${encodeURIComponent(String(sessionId))}/insert`, base).toString(),
    json: Object.freeze({ text: String(text) }),
  });
}

export function buildOutputSessionCancelRequest({ baseUrl = "http://127.0.0.1:3902", sessionId, allowRemote = false } = {}) {
  if (!sessionId) throw new TypeError("sessionId is required");
  const base = assertVoicePlatformUrl(baseUrl, { allowRemote });
  return Object.freeze({
    method: "DELETE",
    url: new URL(`/v1/output/sessions/${encodeURIComponent(String(sessionId))}`, base).toString(),
  });
}

export function buildWsTicketRequest({ baseUrl = "http://127.0.0.1:3900", scope = "/v1/audio/transcriptions/stream", allowRemote = false } = {}) {
  if (!String(scope).startsWith("/")) throw new TypeError("scope must be an absolute path");
  const allowedScopes = new Set([
    "/v1/audio/transcriptions/stream",
    "/ws/transcribe",
    "/ws/events",
    "/ws/tts",
  ]);
  if (!allowedScopes.has(String(scope))) throw new Error("unsupported WebSocket ticket scope");
  const base = assertVoicePlatformUrl(baseUrl, { allowRemote });
  return Object.freeze({
    method: "POST",
    url: new URL("/api/auth/ws-ticket", base).toString(),
    json: Object.freeze({ scope: String(scope) }),
  });
}
