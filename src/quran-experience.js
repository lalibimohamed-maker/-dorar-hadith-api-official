import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(root, "..", "config", "quran-experience-2026.json"), "utf8"));

export function getQuranExperienceConfig() { return config; }
export function getReadingTheme(preference = "system") { return config.reading.themes.includes(preference) ? preference : "system"; }
export function getPrayerConfig() { return config.prayerTimes; }
export function getQiblaConfig() { return config.qibla; }
export function getRuqyahConfig() { return config.ruqyah; }
