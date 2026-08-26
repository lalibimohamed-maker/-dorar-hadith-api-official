import fs from "node:fs";

const manifestPath = "artifacts/source-refresh/manifest.json";
const outputPath = "artifacts/source-refresh/baseline-candidate.json";

if (!fs.existsSync(manifestPath)) {
  throw new Error("Refresh manifest is missing; no baseline candidate can be created.");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const verified = (manifest.sources || []).filter((source) => source.status === "verified");
const blocked = (manifest.sources || []).filter((source) => source.status !== "verified");

const sources = Object.fromEntries(
  verified.map((source) => [source.id, {
    url: source.url,
    finalUrl: source.finalUrl,
    bytes: source.bytes,
    sha256: source.sha256,
    checkedAt: source.checkedAt
  }])
);

const candidate = {
  schemaVersion: 1,
  kind: "source-baseline-candidate",
  authoritative: false,
  sourceManifestSchemaVersion: manifest.schemaVersion,
  generatedAt: new Date().toISOString(),
  summary: {
    total: (manifest.sources || []).length,
    verified: verified.length,
    excludedFromBaseline: blocked.length,
    exclusionReason: "not-verified-by-protected-source-refresh-gate"
  },
  sources
};

fs.mkdirSync("artifacts/source-refresh", { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(candidate, null, 2) + "\n");

if (!verified.length) {
  throw new Error("No source passed the protected verification gate; candidate remains empty and must not become authoritative.");
}

console.log(`Baseline candidate generated: ${verified.length} verified source(s); ${blocked.length} excluded.`);
