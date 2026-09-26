// Compatibility/provider catalog only.
// Canonical model authority remains config/rechercher-omega-model-registry.json.
const MODELS = Object.freeze([
  { id: "qwen2.5-72b", family: "qwen", role: ["reasoning", "research"], license: "Apache-2.0", sourceUrl: "https://free.ai/open-source/" },
  { id: "qwen2.5-coder-32b", family: "qwen", role: ["coding", "maintenance"], license: "Apache-2.0", sourceUrl: "https://free.ai/open-source/" },
  { id: "qwen2.5-7b", family: "qwen", role: ["fast", "classification"], license: "Apache-2.0", sourceUrl: "https://free.ai/open-source/" },
  { id: "mistral-7b", family: "mistral", role: ["fast", "classification"], license: "Apache-2.0", sourceUrl: "https://free.ai/open-source/" },
  { id: "phi-3", family: "phi", role: ["reasoning", "classification"], license: "MIT", sourceUrl: "https://free.ai/open-source/" }
]);

export function listModels() {
  return MODELS.map(model => ({ ...model, role: [...model.role] }));
}

export function resolveModel(id) {
  const model = MODELS.find(item => item.id === id);
  if (!model) throw new Error("Unknown Rechercher model: " + id);
  return { ...model, role: [...model.role] };
}

export function selectModel({ task = "research", preferred = [] } = {}) {
  const candidates = MODELS.filter(model => model.role.includes(task));
  for (const id of preferred) {
    const hit = candidates.find(model => model.id === id);
    if (hit) return { ...hit, role: [...hit.role] };
  }
  if (!candidates.length) throw new Error("No model registered for task: " + task);
  return { ...candidates[0], role: [...candidates[0].role] };
}
