/**
 * Rechercher Ω — execution adapters.
 * Adapters are transport/runtime integrations only.
 */

import { spawn } from "node:child_process";
import path from "node:path";

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const DEFAULT_LOCAL_EXECUTABLES = new Set(["ffmpeg", "ffprobe"]);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error("missing required runtime secret: " + name);
  return value;
}

function assertNoCorpusWrite(input = {}) {
  if (input.corpus_write_allowed === true) {
    throw new Error("Rechercher Ω adapter boundary violation: Corpus writes are forbidden");
  }
}

async function readLimitedBody(response, maxBytes) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error("remote execution response exceeds configured size limit");
  }
  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) throw new Error("remote execution response exceeds configured size limit");
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new Error("remote execution response exceeds configured size limit");
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode());
  return chunks.join("");
}

async function postJson(url, headers, body, { timeoutMs = DEFAULT_TIMEOUT_MS, maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const bodyText = await readLimitedBody(response, maxResponseBytes);
    if (!response.ok) {
      throw new Error("remote execution failed (" + response.status + "): " + bodyText.slice(0, 500));
    }
    return bodyText ? JSON.parse(bodyText) : {};
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("remote execution timed out after " + timeoutMs + "ms");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function executeGemini({ model, contents, generationConfig, timeoutMs, maxResponseBytes, ...input }) {
  assertNoCorpusWrite(input);
  const key = requireEnv("GEMINI_API_KEY");
  const endpoint = process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta";
  return postJson(
    endpoint + "/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key),
    {},
    { contents, generationConfig },
    { timeoutMs, maxResponseBytes }
  );
}

export async function executeGroq({ model, messages, timeoutMs, maxResponseBytes, ...input }) {
  assertNoCorpusWrite(input);
  const key = requireEnv("GROQ_API_KEY");
  const endpoint = process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1/chat/completions";
  return postJson(endpoint, { authorization: "Bearer " + key }, { model, messages }, { timeoutMs, maxResponseBytes });
}

export async function executeHuggingFace({ model, messages, timeoutMs, maxResponseBytes, ...input }) {
  assertNoCorpusWrite(input);
  const key = requireEnv("HF_TOKEN");
  const endpoint = process.env.HF_BASE_URL ?? "https://router.huggingface.co/v1/chat/completions";
  return postJson(endpoint, { authorization: "Bearer " + key }, { model, messages }, { timeoutMs, maxResponseBytes });
}

export async function executeOpenAICompatible({ model, messages, timeoutMs, maxResponseBytes, ...input }) {
  assertNoCorpusWrite(input);
  if (!model) throw new Error("OpenAI-compatible execution requires a model");
  const base = (process.env.OPENAI_COMPATIBLE_BASE_URL ?? "http://127.0.0.1:11434/v1").replace(/\/$/, "");
  const endpoint = base + "/chat/completions";
  const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY;
  const headers = apiKey ? { authorization: "Bearer " + apiKey } : {};
  return postJson(endpoint, headers, { model, messages }, { timeoutMs, maxResponseBytes });
}

export async function executeLocal({
  command,
  args = [],
  cwd,
  env = {},
  allowedExecutables = [...DEFAULT_LOCAL_EXECUTABLES],
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxStdoutBytes = DEFAULT_MAX_RESPONSE_BYTES,
  maxStderrBytes = 1024 * 1024,
  inheritEnvironment = false,
  ...input
}) {
  assertNoCorpusWrite(input);
  if (!command) throw new Error("local execution requires an explicit command");
  if (!Array.isArray(allowedExecutables) || allowedExecutables.length === 0) {
    throw new Error("local execution requires a non-empty executable allowlist");
  }
  const normalizedAllowed = allowedExecutables.map(String);
  const base = path.basename(command);
  if (command.includes("/") || !normalizedAllowed.includes(base)) {
    throw new Error("local executable is not allowlisted: " + base);
  }
  return new Promise((resolve, reject) => {
    const safeEnvironment = inheritEnvironment
      ? { ...process.env, ...env }
      : {
          PATH: process.env.PATH ?? "/usr/bin:/bin",
          HOME: process.env.HOME,
          LANG: process.env.LANG,
          LC_ALL: process.env.LC_ALL,
          TMPDIR: process.env.TMPDIR,
          ...env
        };
    const child = spawn(command, args, {
      cwd,
      env: safeEnvironment,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
      finish(reject, new Error("local execution timed out after " + timeoutMs + "ms"));
    }, timeoutMs);

    child.stdout.on("data", chunk => {
      stdoutBytes += chunk.length;
      if (stdoutBytes <= maxStdoutBytes) stdout += chunk;
      if (stdoutBytes > maxStdoutBytes && !settled) {
        child.kill("SIGTERM");
        finish(reject, new Error("local stdout exceeds configured size limit"));
      }
    });
    child.stderr.on("data", chunk => {
      stderrBytes += chunk.length;
      if (stderrBytes <= maxStderrBytes) stderr += chunk;
      if (stderrBytes > maxStderrBytes && !settled) {
        child.kill("SIGTERM");
        finish(reject, new Error("local stderr exceeds configured size limit"));
      }
    });
    child.once("error", error => finish(reject, error));
    child.once("close", code => {
      if (code === 0) finish(resolve, { code, stdout, stderr });
      else finish(reject, new Error("local execution exited with code " + code + ": " + stderr.slice(0, 500)));
    });
  });
}

export function buildKaggleExecution({ kernel_slug, dataset_refs = [], command, ...input }) {
  assertNoCorpusWrite(input);
  if (!kernel_slug) throw new Error("Kaggle execution requires kernel_slug");
  if (!/^[-a-z0-9_]+\/[-a-z0-9_]+$/i.test(kernel_slug)) {
    throw new Error("invalid Kaggle kernel slug");
  }
  if (!command) throw new Error("Kaggle execution requires an explicit command");
  if (dataset_refs.some(ref => typeof ref !== "string" || !/^[-a-z0-9_]+\/[-a-z0-9_]+$/i.test(ref))) {
    throw new Error("invalid Kaggle dataset reference");
  }
  return {
    backend: "kaggle-gpu",
    mode: "remote_kernel",
    kernel_slug,
    dataset_refs: [...new Set(dataset_refs)],
    command,
    credentials: "runtime_injected",
    corpus_write_allowed: false,
    generated_media_is_evidence: false
  };
}

export function buildAdapterRequest({ backend, model, input = {} }) {
  assertNoCorpusWrite(input);
  if (backend === "gemini-free-tier") return { provider: "gemini", model, input };
  if (backend === "groq-free-plan") return { provider: "groq", model, input };
  if (backend === "huggingface-inference") return { provider: "huggingface", model, input };
  if (backend === "openai-compatible") return { provider: "openai-compatible", model, input };
  if (backend === "kaggle-gpu") return buildKaggleExecution(input);
  if (backend === "local") {
    if (input.allowed_executables && !Array.isArray(input.allowed_executables)) {
      throw new Error("allowed_executables must be an array");
    }
    return { provider: "local", model, input };
  }
  throw new Error("unknown Rechercher Ω execution backend: " + backend);
}
