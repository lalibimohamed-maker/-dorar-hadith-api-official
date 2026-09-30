import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const args = [
  "--yes",
  "esbuild@0.28.2",
  path.join(root, "src/omega-client-core.js"),
  path.join(root, "src/webgpu-inference-worker.js"),
  "--bundle",
  "--minify",
  "--format=esm",
  "--platform=browser",
  "--outdir=" + path.join(root, "dist")
];

const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", args, {
  stdio: "inherit",
  shell: false
});
child.on("exit", code => process.exit(code ?? 1));
child.on("error", error => {
  console.error(error);
  process.exit(1);
});
