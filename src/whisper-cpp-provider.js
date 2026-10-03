import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

export function createWhisperCppProvider({
  modelPath,
  binaryPath = "whisper-cli",
  timeoutMs = 120_000,
} = {}) {
  if (!modelPath) throw new TypeError("modelPath is required");

  async function execute({ audioPath, language = null } = {}) {
    if (!audioPath) throw new TypeError("audioPath is required");

    const dir = await mkdtemp(join(tmpdir(), "dinullah-whisper-"));
    const outputBase = join(dir, "result");

    try {
      const args = [
        "-m", String(modelPath),
        "-f", String(audioPath),
        "-oj",
        "-of", outputBase,
        "-np",
        "-nt",
      ];
      if (language) args.push("-l", String(language));

      await new Promise((resolve, reject) => {
        const child = spawn(binaryPath, args, { stdio: ["ignore", "pipe", "pipe"] });
        let stderr = "";
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error("whisper.cpp inference timeout"));
        }, timeoutMs);

        child.stderr.on("data", chunk => { stderr += chunk; });
        child.on("error", error => {
          clearTimeout(timer);
          reject(error);
        });
        child.on("close", code => {
          clearTimeout(timer);
          if (code !== 0) {
            reject(new Error(stderr.trim() || `whisper.cpp exited with code ${code}`));
            return;
          }
          resolve();
        });
      });

      const jsonPath = `${outputBase}.json`;
      let parsed;
      try {
        parsed = JSON.parse(await readFile(jsonPath, "utf8"));
      } catch (error) {
        throw new Error(`whisper.cpp produced no valid JSON output: ${error.message}`);
      }

      const segments = Array.isArray(parsed.transcription) ? parsed.transcription : [];
      const text = segments.map(segment => String(segment.text || "")).join(" ").trim();
      if (!text) throw new Error("whisper.cpp returned an empty transcript");

      return Object.freeze({
        text,
        language: parsed?.result?.language || parsed?.params?.language || language || null,
        engine: "whisper-cpp-ggml-base-multilingual",
        provenance: "local-runtime",
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  return Object.freeze({
    supports(capability) {
      return capability === "speech-to-text" || capability === "language-identification";
    },
    execute,
  });
}
