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

export function buildTranscriptionRequest({ baseUrl = "http://127.0.0.1:3900", audioFile, model, language, prompt, temperature, stream = false } = {}) {
  if (!audioFile) throw new TypeError("audioFile is required");
  const base = assertVoicePlatformUrl(baseUrl);
  const form = { model: model || "active", file: String(audioFile) };
  if (language) form.language = String(language);
  if (prompt) form.prompt = String(prompt);
  if (temperature != null) form.temperature = Number(temperature);
  if (stream) form.stream = true;
  return Object.freeze({ method: "POST", url: new URL("/v1/audio/transcriptions", base).toString(), form });
}

export function buildSpeechRequest({ baseUrl = "http://127.0.0.1:3900", text, model, voice, language, speed = 1, streamFormat = "audio" } = {}) {
  if (!text) throw new TypeError("text is required");
  if (!["audio","sse"].includes(streamFormat)) throw new Error("invalid speech stream format");
  const base = assertVoicePlatformUrl(baseUrl);
  return Object.freeze({
    method: "POST",
    url: new URL("/v1/audio/speech", base).toString(),
    json: Object.freeze({
      model: model || "active",
      input: String(text),
      voice: voice || "default",
      ...(language ? { language: String(language) } : {}),
      speed: Number(speed),
      stream_format: streamFormat,
    }),
  });
}

export function buildMcpEndpoint({ baseUrl = "http://127.0.0.1:3900" } = {}) {
  const base = assertVoicePlatformUrl(baseUrl);
  return new URL("/mcp/", base).toString();
}
