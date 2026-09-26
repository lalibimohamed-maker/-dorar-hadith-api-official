import test from "node:test";
import assert from "node:assert/strict";
import { createOpenAICompatibleProvider } from "../src/rechercher-ai/openai-compatible.js";
import { createGovernedAgent } from "../src/rechercher-ai/governed-agent.js";
import { createProviderRouter } from "../src/rechercher-ai/provider-contract.js";
import { createSupabaseStore } from "../src/rechercher-ai/operational-store.js";
import { createPostHogObserver } from "../src/rechercher-ai/observability.js";
import { selectModel } from "../src/rechercher-ai/model-registry.js";

test("model registry selects coding model", () => {
  const model = selectModel({ task: "coding" });
  assert.equal(model.id, "qwen2.5-coder-32b");
  assert.equal(model.license, "Apache-2.0");
});

test("OpenAI-compatible adapter is dependency-free", async () => {
  const provider = createOpenAICompatibleProvider({
    id: "fixture", baseUrl: "https://example.test", model: "fixture-model", roles: ["research"], apiKey: "secret",
    fetchImpl: async (_url, init) => ({ ok: true, async json() {
      const body = JSON.parse(init.body);
      return { choices: [{ message: { content: body.messages[0].content } }], usage: { total_tokens: 1 } };
    }})
  });
  const result = await provider.generate({ messages: [{ role: "user", content: "test" }] });
  assert.equal(result.text, "test");
});

test("governed agent blocks corpus writes", async () => {
  const provider = { id: "fixture", kind: "test", roles: ["research"], generate: async () => ({ text: "ok", provider: "fixture", model: "x" }) };
  const agent = createGovernedAgent({ provider, provenance: { source: "fixture" } });
  const result = await agent.run({ action: "analyze", messages: [] });
  assert.equal(result.corpusWrite, false);
  await assert.rejects(() => agent.run({ action: "write", messages: [] }), /blocked/);
});

test("router is provider-neutral", () => {
  const p = { id: "p", kind: "test", roles: ["research"], generate: async () => ({}) };
  assert.equal(createProviderRouter([p]).forRole("research"), p);
});

test("optional operational adapters fail closed", async () => {
  assert.equal((await createSupabaseStore({ url: "", serviceKey: "" }).insert("jobs", {})).skipped, true);
  assert.equal((await createPostHogObserver({ host: "", projectApiKey: "" }).capture("x")).skipped, true);
});

test("unsafe operational table names are rejected", async () => {
  const store = createSupabaseStore({ url: "", serviceKey: "" });
  await assert.rejects(() => store.insert("jobs;drop", {}), /unsafe/);
});
