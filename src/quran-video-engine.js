import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(root, "..", "config", "quran-video-engine-2026.json"), "utf8"));

export function getQuranVideoConfig() { return config; }

export function validateVideoSelection({ surahs = [], ranges = [], reciterId, format = "mp4", resolution = "1080p" }) {
  if (!Array.isArray(surahs) || !Array.isArray(ranges)) throw new TypeError("اختيار السور غير صحيح");
  if (!reciterId) throw new TypeError("يجب اختيار القارئ");
  if (!config.output.formats.includes(format)) throw new RangeError("صيغة الفيديو غير مدعومة");
  if (!config.output.resolutionPresets.includes(resolution)) throw new RangeError("دقة الفيديو غير مدعومة");
  return { surahs, ranges, reciterId, format, resolution, audioSync: true, ayahSync: true, wordSync: true };
}

export function buildVideoBackgroundPrompt(prompt, preset = "nature") {
  const clean = String(prompt || "").trim();
  return { preset, prompt: clean || preset, aiGenerated: true, quranTextImmutable: true, scientificVisualsRequireEvidence: true };
}
