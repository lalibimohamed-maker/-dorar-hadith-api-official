import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SOURCES = [
  "config/source-registry.json",
  "config/official-institution-sources.json",
  "data/quran-knowledge-catalog.json",
  "data/seerah-catalog-2026.json",
  "config/translation-sources-2026.json",
  "data/reciters.json",
];

const REQUIRED_DOMAINS = [
  ["quran", "القرآن وعلومه"],
  ["tafsir", "التفسير"],
  ["tadabbur", "التدبر والهدايات"],
  ["hadith", "الحديث وعلومه"],
  ["sirah", "السيرة والمغازي والشمائل"],
  ["fiqh", "الفقه والمعاملات"],
  ["aqidah", "العقيدة"],
  ["library", "المكتبة الإسلامية"],
];

function collectUrls(value, out = new Set()) {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) out.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, out);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectUrls(item, out);
  }
  return out;
}

async function readJson(relative) {
  const file = path.join(ROOT, relative);
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Deen-Allah-Encyclopedia-Source-Watch/2026",
        accept: "text/html,application/json,text/plain;q=0.9,*/*;q=0.1",
      },
    });
    return { url, ok: response.ok, status: response.status, finalUrl: response.url };
  } catch (error) {
    return { url, ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

const loaded = new Map();
for (const file of SOURCES) {
  try {
    loaded.set(file, await readJson(file));
  } catch (error) {
    loaded.set(file, { __error: error instanceof Error ? error.message : String(error) });
  }
}

const urls = new Set();
for (const value of loaded.values()) collectUrls(value, urls);
const probes = await Promise.all([...urls].slice(0, 120).map(probe));

const failed = probes.filter((x) => !x.ok);
const sourceRegistry = loaded.get("config/source-registry.json");
const categoryCounts = new Map(REQUIRED_DOMAINS.map(([id]) => [id, 0]));
for (const source of sourceRegistry?.sources ?? []) {
  if (source?.category && categoryCounts.has(source.category)) {
    categoryCounts.set(source.category, categoryCounts.get(source.category) + 1);
  }
}

const sparse = REQUIRED_DOMAINS.filter(([id]) => (categoryCounts.get(id) ?? 0) === 0);

const lines = [
  "# Din Allah Encyclopedia — Continuous Content Watch",
  "",
  `Generated: ${new Date().toISOString()}`,
  `Registered source URLs checked: ${probes.length}`,
  `Unavailable/unreachable: ${failed.length}`,
  "",
  "## Coverage radar",
  "",
  ...REQUIRED_DOMAINS.map(([id, label]) => `- ${label} (${id}): ${categoryCounts.get(id) ?? 0} registered source records`),
  "",
  "## Source health",
  "",
  ...probes.map((x) => `- ${x.ok ? "OK" : "FAIL"} ${x.status || "NETWORK"} — ${x.url}${x.error ? ` — ${x.error}` : ""}`),
  "",
  "## Automation policy",
  "",
  "- Discovery and health checks run automatically on schedule.",
  "- Source failure creates a review issue; it never silently replaces scholarly content.",
  "- Catalog presence is not treated as scholarly-content completion.",
  "- Rights, provenance, evidence, and role separation remain mandatory before promotion.",
  "- Dependency and engine updates are proposed through automated update PRs and still pass protected-main review.",
  "",
];

if (sparse.length) {
  lines.push("## Coverage gaps detected");
  lines.push("");
  for (const [id, label] of sparse) lines.push(`- Missing registered source coverage: ${label} (${id})`);
  lines.push("");
}

await fs.writeFile("continuous-content-watch.md", `${lines.join("\n")}\n`, "utf8");
console.log(lines.join("\n"));
process.exitCode = failed.length || sparse.length ? 2 : 0;
