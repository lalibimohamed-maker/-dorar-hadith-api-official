import { access } from 'node:fs/promises';
import { getLocalAIStatus } from '../src/ai/local-llm-runtime.mjs';
import { LOCAL_MODEL_REGISTRY } from '../src/ai/local-model-registry.mjs';

async function exists(path) {
  if (!path) return false;
  try { await access(path); return true; } catch { return false; }
}

const status = getLocalAIStatus();
const roles = {};
for (const [id, spec] of Object.entries(LOCAL_MODEL_REGISTRY)) {
  roles[id] = {
    role: spec.role,
    configuredPath: Boolean(process.env[spec.pathEnv]),
    filePresent: await exists(process.env[spec.pathEnv]),
    checksumConfigured: Boolean(process.env[spec.sha256Env])
  };
}

let runtimeInstalled = true;
try {
  await import('node-llama-cpp');
} catch {
  runtimeInstalled = false;
}

console.log(JSON.stringify({ ...status, runtimeInstalled, roles }, null, 2));
