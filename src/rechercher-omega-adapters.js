/**
 * Rechercher Ω — execution adapters.
 * Adapters are transport/runtime integrations only.
 */

import { spawn } from "node:child_process";

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

async function postJson(url, headers, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error("remote execution failed (" + response.status + "): " + bodyText.slice(0, 500));
  }
  return bodyText ? JSON.parse(bodyText) : {};
}

export async function executeGemini({ model, contents, generationConfig, ...input }) {
  assertNoCorpusWrite(input);
  const key = requireEnv("GEMINI_API_KEY");
  const endpoint = process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta";
  return postJson(
    endpoint + "/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key),
    {},
    { contents, generationConfig }
  );
}

export async function executeGroq({ model, messages, ...input }) {
  assertNoCorpusWrite(input);
  const key = requireEnv("GROQ_API_KEY");
  const endpoint = process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1/chat/completions";
  return postJson(endpoint, { authorization: "Bearer " + key }, { model, messages });
}

export async function executeHuggingFace({ model, messages, ...input }) {
  assertNoCorpusWrite(input);
  const key = requireEnv("HF_TOKEN");
  const endpoint = process.env.HF_BASE_URL ?? "https://router.huggingface.co/v1/chat/completions";
  return postJson(endpoint, { authorization: "Bearer " + key }, { model, messages });
}

export async function executeLocal({ command, args = [], cwd, env = {}, ...input }) {
  assertNoCorpusWrite(input);
  if (!command) throw new Error("local execution requires an explicit command");
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", code => {
      if (code === 0) resolve({ code, stdout, stderr });
      else reject(new Error("local execution exited with code " + code + ": " + stderr.slice(0, 500)));
    });
  });
}

export function buildKaggleExecution({ kernel_slug, dataset_refs = [], command, ...input }) {
  assertNoCorpusWrite(input);
  if (!kernel_slug) throw new Error("Kaggle execution requires kernel_slug");
  if (!command) throw new Error("Kaggle execution requires an explicit command");
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

export function buildAdapterRequest({ backend, model, input }) {
  if (backend === "gemini-free-tier") return { provider: "gemini", model, input };
  if (backend === "groq-free-plan") return { provider: "groq", model, input };
  if (backend === "huggingface-inference") return { provider: "huggingface", model, input };
  if (backend === "kaggle-gpu") return buildKaggleExecution(input);
  if (backend === "local") return { provider: "local", model, input };
  throw new Error("unknown Rechercher Ω execution backend: " + backend);
}
