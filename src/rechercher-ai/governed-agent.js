import { validateProvider } from "./provider-contract.js";

const ALLOWED_ACTIONS = new Set(["read", "discover", "analyze", "classify", "propose"]);

export function createGovernedAgent({ provider, provenance, evidence = [] } = {}) {
  validateProvider(provider);
  if (!provenance?.source) throw new TypeError("provenance.source is required");

  return Object.freeze({
    async run({ action = "analyze", messages, task = "research" } = {}) {
      if (!ALLOWED_ACTIONS.has(action)) {
        throw new Error("AI action blocked by Rechercher governance: " + action);
      }
      const result = await provider.generate({ messages });
      return Object.freeze({
        action,
        task,
        provider: result.provider,
        model: result.model,
        text: result.text,
        usage: result.usage,
        provenance: { ...provenance },
        evidence: evidence.map(item => ({ ...item })),
        corpusWrite: false
      });
    }
  });
}
