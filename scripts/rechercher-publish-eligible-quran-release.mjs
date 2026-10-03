#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

function arg(name, fallback = "") {
  const prefix = `--${name}`;
  const index = process.argv.findIndex((value) => value === prefix || value.startsWith(`${prefix}=`));
  if (index < 0) return fallback;
  const value = process.argv[index];
  if (value.startsWith(`${prefix}=`)) return value.slice(prefix.length);
  return process.argv[index + 1] ?? fallback;
}
const root = path.resolve(arg("root", "."));
let manifestPath = path.resolve(arg("manifest"));
if (!arg("manifest")) throw new Error("manifest argument is required");
try {
  const manifestStat = await fs.stat(manifestPath);
  if (manifestStat.isDirectory()) manifestPath = path.join(manifestPath, "manifest.json");
} catch {
  throw new Error(`manifest path does not exist: ${manifestPath}`);
}
const repository = arg("repository", "lalibimohamed-maker/dinullah-matrix-6384-storage-01");
const releasePrefix = arg("release-prefix", "rechercher-quran");
if (!/^\S+\/\S+$/.test(repository)) throw new Error("invalid Release repository");
if (!process.env.GH_TOKEN) throw new Error("GH_TOKEN is required");

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

function explicitEligible(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    (
      (value.storage_visibility === "publication-eligible" && value.public_browser === true) ||
      value.matrix_eligibility === "verified_public" ||
      value.public_redistribution_grant === true ||
      value.public_publishable === true
    )
  );
}

const globalEligible = explicitEligible(manifest);
const candidates = new Map();

function addCandidate(candidatePath, eligible, provenance) {
  if (!eligible || typeof candidatePath !== "string" || !/\.pdf$/i.test(candidatePath)) return;
  const absolute = path.resolve(root, candidatePath);
  const relative = path.relative(root, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return;
  candidates.set(relative, { path: absolute, provenance });
}

function walk(value, inheritedEligible = globalEligible, provenance = manifest) {
  if (!value || typeof value !== "object") return;
  const eligible = inheritedEligible || explicitEligible(value);

  if (typeof value.path === "string" && /\.pdf$/i.test(value.path)) {
    addCandidate(value.path, eligible, provenance);
  }
  if (value.acquired && typeof value.acquired === "object" && typeof value.acquired.path === "string") {
    addCandidate(value.acquired.path, eligible || explicitEligible(value.acquired), value);
  }
  if (Array.isArray(value.downloaded)) {
    for (const row of value.downloaded) {
      if (row && typeof row === "object" && typeof row.path === "string") {
        addCandidate(row.path, eligible || explicitEligible(row), row);
      }
    }
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === "path" || key === "acquired" || key === "downloaded") continue;
    walk(child, eligible, value);
  }
}
walk(manifest);

const maxAssetBytes = 2 * 1024 * 1024 * 1024;
const files = [];
for (const item of candidates.values()) {
  try {
    const stat = await fs.stat(item.path);
    if (!stat.isFile() || stat.size < 1) continue;
    if (stat.size >= maxAssetBytes) throw new Error("Release asset exceeds GitHub 2 GiB per-asset limit: " + item.path + " (" + stat.size + " bytes)");
    const fd = await fs.open(item.path, "r");
    const head = Buffer.alloc(5);
    await fd.read(head, 0, 5, 0);
    await fd.close();
    if (head.toString("ascii") !== "%PDF-") continue;
    files.push(item);
  } catch {
    // Missing candidates remain research evidence and are not released.
  }
}

if (files.length === 0) {
  console.log("QURAN_MATRIX_RELEASE_NO_ELIGIBLE_PDFS");
  process.exit(0);
}

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
}

const tag = `${releasePrefix}-${process.env.GITHUB_RUN_ID || Date.now()}`;
gh([
  "release", "create", tag, "--repo", repository, "--target", "main",
  "--title", `Rechercher Quran — ${tag}`,
  "--notes", "Publication-eligible Quran PDF assets. Explicit item-level rights/integrity evidence required. Canonical plaintext PDFs only; no Corpus write.",
  "--latest=false"
]);

const inventory = JSON.parse(gh([
  "api", "--paginate", "-H", "Accept: application/vnd.github+json",
  `/repos/${repository}/releases?per_page=100`
]));
const existing = new Set();
for (const release of inventory) {
  for (const asset of release.assets || []) {
    const digest = String(asset.digest || "");
    if (asset.state === "uploaded" && digest.startsWith("sha256:")) existing.add(digest);
  }
}

const published = [];
const skipped = [];
for (const item of files) {
  const sha = execFileSync("sha256sum", [item.path], { encoding: "utf8" }).trim().split(/\s+/)[0];
  const digest = `sha256:${sha}`;
  if (existing.has(digest)) {
    skipped.push({ file: item.path, sha256: sha, reason: "existing_release_asset" });
    continue;
  }
  const asset = `${sha}_${path.basename(item.path)}`;
  gh(["release", "upload", tag, `${item.path}#${asset}`, "--repo", repository, "--clobber=false"]);
  const releaseJson = JSON.parse(gh(["api", "-H", "Accept: application/vnd.github+json", `/repos/${repository}/releases/tags/${tag}`]));
  const uploaded = (releaseJson.assets || []).find((candidate) => candidate.name === asset && candidate.state === "uploaded");
  if (!uploaded) throw new Error("Release upload verification failed: " + asset);
  if (String(uploaded.digest || "") !== digest) throw new Error("Release SHA-256 mismatch for " + asset + ": expected " + digest + ", got " + (uploaded.digest || "missing"));
  existing.add(digest);
  published.push({ file: item.path, sha256: sha, release: tag, asset, repository });
}

const output = {
  schema: "din-allah-encyclopedia/rechercher-quran-release-persistence/v1",
  storage_model: "github-releases-only",
  repository,
  release: tag,
  published,
  skipped,
  blocked_candidates: candidates.size - files.length,
  encrypted_final_artifacts: false,
  lfs_pdf_persistence: false,
  corpus_write: false,
  release_verified: true
};
await fs.writeFile(path.join(path.dirname(manifestPath), "release-persistence.json"), JSON.stringify(output, null, 2) + "\n", "utf8");
console.log(`QURAN_MATRIX_RELEASE_OK published=${published.length} skipped=${skipped.length} blocked=${output.blocked_candidates}`);
