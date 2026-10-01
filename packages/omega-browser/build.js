import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, "src");
const dist = path.join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const files = [
  "omega-client-core.js",
  "omega-local-bridge.js",
  "local-bundle-loader.js",
  "arabic-query-normalizer.js",
  "webgpu-inference-worker.js",
  "omega-hardware-guardian.js",
  "omega-audio-session.js",
  "omega-visual-pruner.js",
  "omega-multimodal-context-guard.js"
];

for (const file of files) {
  await cp(path.join(src, file), path.join(dist, file));
}

await writeFile(
  path.join(dist, "index.js"),
  [
    'export * from "./omega-client-core.js";',
    'export * from "./omega-local-bridge.js";',
    'export * from "./local-bundle-loader.js";',
    'export * from "./arabic-query-normalizer.js";',
    'export * from "./omega-hardware-guardian.js";',
    'export * from "./omega-audio-session.js";',
    'export * from "./omega-visual-pruner.js";',
    'export * from "./omega-multimodal-context-guard.js";'
  ].join("\n") + "\n",
  "utf8"
);

console.log("Omega browser package built locally without network or package installation:", dist);
