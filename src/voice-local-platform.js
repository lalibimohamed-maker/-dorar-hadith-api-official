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

export function buildSpeechRequest({ baseUrl = "http://127.0.0.1:3900", text, model, voice, language, speed = 1, responseFormat = "wav", allowRemote = false } = {}) {
  if (!text) throw new TypeError("text is required");
  const allowedFormats = new Set(["mp3","opus","aac","flac","wav","pcm"]);
  if (!allowedFormats.has(responseFormat)) throw new Error("invalid speech response format");
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

export function buildSpeechDiscoveryEndpoint({ baseUrl = "http://127.0.0.1:3900", allowRemote = false } = {}) {
  const base = assertVoicePlatformUrl(baseUrl, { allowRemote });
  return new URL("/.well-known/voicestudio-speech", base).toString();
}

export function buildVoicesEndpoint({ baseUrl = "http://127.0.0.1:3900", allowRemote = false } = {}) {
  const base = assertVoicePlatformUrl(baseUrl, { allowRemote });
  return new URL("/v1/audio/voices", base).toString();
}

export function buildVoiceAuthHeaders({ bearerToken } = {}) {
  if (!bearerToken) throw new TypeError("bearerToken is required");
  return Object.freeze({ Authorization: `Bearer ${String(bearerToken)}` });
}
