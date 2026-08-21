import registry from "../config/fiqh-fatawa-sources.json" with { type: "json" };

export function listFiqhFatwaSources() {
  return registry.sources.map((source) => ({ ...source, corpus: registry.policy.corpus }));
}

export function listFiqhTopics() {
  return [...registry.topics];
}

export function listInheritanceTopics() {
  return [...registry.inheritance.topics];
}

export function getFiqhFatwaRegistry() {
  return {
    id: registry.id,
    titleAr: registry.titleAr,
    descriptionAr: registry.descriptionAr,
    policy: registry.policy,
    sources: listFiqhFatwaSources(),
    topics: listFiqhTopics(),
    inheritance: registry.inheritance,
  };
}
