import { validateProvider } from "./provider-contract.js";

export function createOpenAICompatibleProvider({
  id, baseUrl, apiKey, model, roles = ["research"], fetchImpl = globalThis.fetch
}) {
  if (!id || !baseUrl || !model) throw new TypeError("id, baseUrl and model are required");
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
  const provider = {
    id, kind: "openai-compatible", model, roles,
    async generate({ messages, temperature = 0, maxTokens, signal } = {}) {
      const response = await fetchImpl(baseUrl.replace(/\/$/, "") + "/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", ...(apiKey ? { authorization: "Bearer " + apiKey } : {}) },
        body: JSON.stringify({ model, messages, temperature, ...(maxTokens ? { max_tokens: maxTokens } : {}) }),
        signal
      });
      if (!response.ok) throw new Error("AI provider HTTP " + response.status);
      const payload = await response.json();
      return { text: payload?.choices?.[0]?.message?.content ?? "", raw: payload, usage: payload?.usage ?? null, provider: id, model };
    }
  };
  validateProvider(provider);
  return Object.freeze(provider);
}
