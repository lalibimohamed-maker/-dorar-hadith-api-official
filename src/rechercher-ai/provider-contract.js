export const PROVIDER_ROLES = Object.freeze([
  "research","coding","classification","embeddings","structured-output"
]);

export function validateProvider(provider) {
  if (!provider || typeof provider !== "object") throw new TypeError("provider is required");
  if (typeof provider.id !== "string" || typeof provider.kind !== "string") throw new TypeError("provider.id and provider.kind are required");
  if (typeof provider.generate !== "function") throw new TypeError("provider.generate must be a function");
  if (!Array.isArray(provider.roles) || !provider.roles.some(role => PROVIDER_ROLES.includes(role))) throw new TypeError("provider.roles is invalid");
  return true;
}

export function createProviderRouter(providers = []) {
  providers.forEach(validateProvider);
  const byRole = new Map();
  for (const provider of providers) {
    for (const role of provider.roles) if (!byRole.has(role)) byRole.set(role, provider);
  }
  return Object.freeze({
    list: () => providers.map(p => p.id),
    forRole: role => {
      const provider = byRole.get(role);
      if (!provider) throw new Error("No AI provider registered for role: " + role);
      return provider;
    }
  });
}
