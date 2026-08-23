import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(root, "..", "config", "quran-experience-2026.json"), "utf8"));
const reciterRegistry = JSON.parse(fs.readFileSync(path.join(root, "..", "data", "reciters.json"), "utf8"));

export function getQuranExperienceConfig() { return config; }
export function getReadingTheme(preference = "system") { return config.themes?.includes(preference) ? preference : (config.reading?.themes?.includes(preference) ? preference : "system"); }
export function getPrayerConfig() { return config.prayerTimes; }
export function getQiblaConfig() { return config.qibla; }
export function getRuqyahConfig() { return config.ruqyah; }
export function getReciterRegistry() { return reciterRegistry; }
export function getMemorizationConfig() { return config.reading.memorization; }
export function validateMemorizationSelection(startAyah, endAyah, repeatCount) {
  const m = config.reading.memorization;
  const start = Number(startAyah); const end = Number(endAyah); const repeats = Number(repeatCount);
  if (!Number.isInteger(start) || !Number.isInteger(end) || !Number.isInteger(repeats)) throw new TypeError("آيات التحديد وعدد التكرار يجب أن تكون أعداداً صحيحة");
  if (start < 1 || end < start) throw new RangeError("نطاق الآيات غير صحيح");
  if (end - start + 1 < m.minAyahs || end - start + 1 > m.maxAyahs) throw new RangeError(`اختر من ${m.minAyahs} إلى ${m.maxAyahs} آية`);
  if (repeats < m.minRepeats || repeats > m.maxRepeats) throw new RangeError(`اختر من ${m.minRepeats} إلى ${m.maxRepeats} تكراراً`);
  return { startAyah: start, endAyah: end, ayahCount: end - start + 1, repeatCount: repeats, loopMode: m.loopMode };
}
