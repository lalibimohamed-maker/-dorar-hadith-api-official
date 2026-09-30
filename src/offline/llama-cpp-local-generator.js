/**
 * Rechercher Ω — llama.cpp local desktop adapter.
 *
 * Uses llama-cli with an argument array and never a shell, so prompts cannot
 * become shell syntax. The model file is local and GGUF is verified before use
 * by the caller's offline artifact policy.
 */

import { spawn } from "node:child_process";

function collectProcess(child) {
  return new Promise((resolve, reject) => {
    const stdout = [];
    const stderr = [];
    child.stdout?.on("data", chunk => stdout.push(Buffer.from(chunk)));
    child.stderr?.on("data", chunk => stderr.push(Buffer.from(chunk)));

    child.once("error", reject);
    child.once("close", (code, signal) => {
      const output = Buffer.concat(stdout).toString("utf8").trim();
      const error = Buffer.concat(stderr).toString("utf8").trim();
      if (code !== 0) {
        const failure = new Error(
          "LLAMA_CPP_FAILED: exit=" + String(code) +
          " signal=" + String(signal ?? "") +
          (error ? " " + error.slice(-4000) : "")
        );
        failure.code = "LLAMA_CPP_FAILED";
        reject(failure);
        return;
      }
      resolve(output);
    });
  });
}

export function createLlamaCppLocalGenerator({
  executable = "llama-cli",
  modelPath,
  threads = null,
  contextSize = null,
  nPredict = 256,
  systemPrompt = "Use only supplied verified evidence. Never invent unsupported scholarly claims.",
  extraArgs = []
} = {}) {
  if (!modelPath || typeof modelPath !== "string") {
    throw new TypeError("GGUF modelPath is required");
  }

  return {
    kind: "llama-cpp-local",
    executable,
    modelPath,
    async generate({ query, evidence = [], max_new_tokens = nPredict } = {}) {
      const evidenceText = evidence.map(item => [
        "source_id=" + String(item?.sourceId ?? item?.source_id ?? item?.id ?? ""),
        "citation=" + String(item?.citation ?? ""),
        "text=" + String(item?.text ?? item?.text_raw ?? "")
      ].join("\\n")).join("\\n---\\n");

      const prompt = [
        systemPrompt,
        "Evidence:",
        evidenceText,
        "Question:",
        String(query ?? ""),
        "Answer:"
      ].join("\\n");

      const args = ["-m", modelPath, "-p", prompt, "-n", String(max_new_tokens), "-st", "--no-display-prompt"];
      if (Number.isInteger(threads) && threads > 0) args.push("-t", String(threads));
      if (Number.isInteger(contextSize) && contextSize > 0) args.push("-c", String(contextSize));
      args.push(...extraArgs);

      const child = spawn(executable, args, {
        shell: false,
        stdio: ["ignore", "pipe", "pipe"]
      });
      const output = await collectProcess(child);
      if (!output) throw new Error("LOCAL_MODEL_EMPTY_OUTPUT");
      return output;
    }
  };
}
