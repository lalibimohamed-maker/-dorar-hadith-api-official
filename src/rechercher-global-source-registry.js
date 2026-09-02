import registry from '../config/rechercher-global-islamic-sources-2026.json' with { type: 'json' };

const OPEN_ACCESS = new Set(['open']);

export function getGlobalIslamicSources({ role = null, region = null, language = null } = {}) {
  return registry.sources.filter(source =>
    (!role || source.roles.includes(role)) &&
    (!region || source.region === region) &&
    (!language || source.languages.includes(language))
  );
}

export function getSourceById(id) {
  return registry.sources.find(source => source.id === id) ?? null;
}

export function getDiscoverySources() {
  return registry.sources.filter(source =>
    source.roles.some(role => /discovery|books|manuscripts|full-text|open-books|work-identity|edition-identity|catalogue|library|public-domain-books|global-manuscript-discovery/u.test(role))
  );
}

export function accessNeedsItemRightsCheck(source) {
  return !OPEN_ACCESS.has(source?.access) || source?.rights !== 'metadata';
}

export function buildProviderPlan({ includeConditional = true } = {}) {
  return getDiscoverySources()
    .filter(source => includeConditional || OPEN_ACCESS.has(source.access))
    .map((source, index) => ({
      ...source,
      priority: source.access === 'open' ? 0 : source.access.startsWith('open/') ? 1 : 2,
      order: index
    }))
    .sort((a, b) => a.priority - b.priority || a.order - b.order);
}

export const GLOBAL_ISLAMIC_SOURCE_REGISTRY_VERSION = registry.schemaVersion;
export const GLOBAL_ISLAMIC_SOURCE_COUNT = registry.sources.length;
