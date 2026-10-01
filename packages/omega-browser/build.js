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
  "webgpu-inference-worker.js"
];

for (const file of files) {
  await cp(path.join(src, file), path.join(dist, file));
}

await writeFile(
  path.join(dist, "index.js"),
  'export * from "./omega-client-core.js";\nexport * from "./omega-local-bridge.js";\nexport * from "./local-bundle-loader.js";\nexport * from "./arabic-query-normalizer.js";\n',
  "utf8"
);

console.log("Omega browser package built locally without network or package installation:", dist);
