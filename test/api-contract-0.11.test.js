import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import test from "node:test";

const repoRoot = new URL("..", import.meta.url);

async function startServer(extraEnv = {}) {
  const child = spawn(process.execPath, ["dorar_json_api.js"], {
    cwd: repoRoot.pathname,
    env: {
      ...process.env,
      PORT: "0",
      PUBLIC_MAX_PER_MINUTE: "1000",
      APP_MAX_PER_MINUTE: "1000",
      REQUEST_TIMEOUT_MS: "3000",
      TRUST_PROXY_HEADERS: "false",
      ...extraEnv
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server start timeout: ${output}`)), 10_000);
    const onData = (chunk) => {
      output += chunk.toString();
      const match = output.match(/listening on 0\.0\.0\.0:(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      if (code !== 0) {
        clearTimeout(timer);
        reject(new Error(`server exited with ${code}: ${output}`));
      }
    });
  });

  return {
    child,
    base: `http://127.0.0.1:${port}`,
    stop() {
      child.kill("SIGTERM");
    }
  };
}

test("API 0.11 runtime exposes the documented Quran video, scientific-signs and concept routes", async (t) => {
  const server = await startServer();
  t.after(() => server.stop());

  const health = await fetch(`${server.base}/health`);
  assert.equal(health.status, 200);
  const healthBody = await health.json();
  assert.equal(healthBody.version, "0.11.0");
  assert.equal(healthBody.name, "موسوعة دينُ الله");

  const videoConfig = await fetch(`${server.base}/quran/video/config`);
  assert.equal(videoConfig.status, 200);

  const videoValidation = await fetch(`${server.base}/quran/video/validate`, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({surahs: [2], ranges: [{start: 1, end: 10}], reciterId: "verified-reciter", format: "mp4", resolution: "1080p"})
  });
  assert.equal(videoValidation.status, 200);

  const background = await fetch(`${server.base}/quran/video/background`, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({prompt: "سماء هادئة", preset: "sky"})
  });
  assert.equal(background.status, 200);
  assert.equal((await background.json()).data.quranTextImmutable, true);

  const scientificConfig = await fetch(`${server.base}/quran/scientific-signs/config`);
  assert.equal(scientificConfig.status, 200);

  const scientificProject = await fetch(`${server.base}/quran/scientific-signs/project`, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({topic: "الماء", ayahs: ["21:30"], primaryLanguage: "ar", additionalLanguages: ["en"]})
  });
  assert.equal(scientificProject.status, 200);

  const concept = await fetch(`${server.base}/concept?term=%D8%A7%D9%84%D8%A5%D9%8A%D9%85%D8%A7%D9%86&lang=ar`);
  assert.equal(concept.status, 200);

  const postSearch = await fetch(`${server.base}/search?q=test`, {method: "POST"});
  assert.equal(postSearch.status, 405);
  assert.match(postSearch.headers.get("allow") || "", /GET/);

  const badJson = await fetch(`${server.base}/quran/video/validate`, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: "{"
  });
  assert.equal(badJson.status, 400);
});

test("API key dailyLimit is enforced separately from the per-minute limit", async (t) => {
  const rawKey = "api-contract-test-key";
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const server = await startServer({
    APP_KEYS_JSON: JSON.stringify([{name: "contract-test", keyHash, dailyLimit: 1, enabled: true}])
  });
  t.after(() => server.stop());

  const first = await fetch(`${server.base}/health`, {headers: {"x-api-key": rawKey}});
  assert.equal(first.status, 200);

  const second = await fetch(`${server.base}/locales`, {headers: {"x-api-key": rawKey}});
  assert.equal(second.status, 429);
  const body = await second.json();
  assert.equal(body.error, "Daily API key limit exceeded");
});

test("Render and package deployment contract uses Node 22, npm ci, and API 0.11.0", async () => {
  const render = await fs.readFile(new URL("../render.yaml", import.meta.url), "utf8");
  const packageJson = JSON.parse(await fs.readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.match(render, /runtime: node/);
  assert.match(render, /plan: free/);
  assert.match(render, /buildCommand: npm ci /);
  assert.match(render, /NODE_VERSION\n\s+value: 22/);
  assert.match(render, /MAX_JSON_BODY_BYTES/);
  assert.match(render, /TRUST_PROXY_HEADERS/);
  assert.equal(packageJson.version, "0.11.0");
  assert.equal(packageJson.scripts.start, "node src/accelerated-server.js");
});
