import registry from "../config/api-activation-registry-2026.json" with { type: "json" };

export function apiActivationRegistry() {
  return registry;
}

export function apiActivation(id) {
  const item = registry.connectors.find((connector) => connector.id === id);
  return item ? { ...item } : null;
}

export function apiActivationReady(id, stage) {
  const item = apiActivation(id);
  return Boolean(item && item[stage] === true);
}
