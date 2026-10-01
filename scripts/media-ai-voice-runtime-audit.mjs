import fs from "node:fs";
import { execFileSync } from "node:child_process";

const outDir = "audit-output";
fs.mkdirSync(outDir, { recursive: true });

function exists(command) {
  try { execFileSync("bash", ["-lc", "command -v " + command], { stdio: "ignore" }); return true; }
  catch { return false; }
}
function version(command, args) {
  try { return execFileSync(command, args, { encoding: "utf8", timeout: 30000 }).split("\n")[0]; }
  catch { return null; }
}

const checks = [];
const add = (id, domain, status, detail, evidence = null) =>
  checks.push({ id, domain, status, detail, evidence });

for (const [id, command, domain, detail] of [
  ["ffmpeg", "ffmpeg", "media", "transcoding"],
  ["tesseract", "tesseract", "media/ocr", "OCR"],
  ["whisper.cpp", "whisper-cli", "voice", "speech-to-text"],
  ["piper", "piper", "voice", "text-to-speech"],
  ["openwakeword", "openwakeword", "voice", "wake word"],
]) {
  const ok = exists(command);
  add(id, domain, ok ? "RUNTIME_PRESENT" : "GAP", detail, ok ? version(command, ["--version"]) : null);
}

const tests = [
  "test/assistant-runtime.test.js",
  "test/multimodal-runtime.test.js",
  "test/voice-config.test.js",
  "test/voice-e2e-routing.test.js",
  "test/media-provider-adapters.test.js",
  "test/din-allah-media-engine-clean.test.js",
  "test/quran-video-engines.test.js",
];
for (const file of tests) {
  try {
    execFileSync(process.execPath, ["--test", file], { stdio: "pipe", timeout: 120000 });
    add(file, "runtime-contract", "RUNTIME_VERIFIED", "Node test passed");
  } catch (e) {
    add(file, "runtime-contract", "GAP", "Node test failed", String(e.stderr || e.stdout || e.message));
  }
}

add("omega-model-inference", "AI", process.env.OMEGA_RUNTIME_ASSETS ? "ASSET_PATH_PRESENT" : "GAP",
  "Release presence is not accepted as runtime proof",
  process.env.OMEGA_RUNTIME_ASSETS || null);

const result = {
  generatedAt: new Date().toISOString(),
  policy: {
    releaseIsNotRuntimeProof: true,
    gapAcquisitionDisabled: true,
    quranGeneratedTtsForbidden: true
  },
  checks,
  counts: checks.reduce((a, x) => ((a[x.status] = (a[x.status] || 0) + 1), a), {})
};

fs.writeFileSync(outDir + "/media-ai-voice-runtime-audit.json", JSON.stringify(result, null, 2));
fs.writeFileSync(outDir + "/media-ai-voice-runtime-audit.md",
  "# Media + AI + يا بوابة العلم Runtime Audit\n\n" +
  "| Domain | Engine | Status | Detail |\n|---|---|---|---|\n" +
  checks.map(x => "| " + x.domain + " | " + x.id + " | " + x.status + " | " + x.detail + " |").join("\n") +
  "\n\nGap acquisition is intentionally disabled in this audit.\n");

console.log(JSON.stringify(result, null, 2));
