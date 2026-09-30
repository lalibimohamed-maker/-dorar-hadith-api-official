(() => {
  const state = { search: null, concept: null };

  function assertFunction(value, name) {
    if (value != null && typeof value !== "function") {
      throw new TypeError(name + " must be a function or null");
    }
  }

  function publish() {
    window.deenAllahOmegaLocalSearch = state.search;
    window.deenAllahOmegaLocalConcept = state.concept;
    window.deenAllahOmegaLocalProviderReady = Object.freeze({
      search: typeof state.search === "function",
      concept: typeof state.concept === "function"
    });
  }

  window.deenAllahRegisterLocalOmegaProviders = Object.freeze(({
    search = null,
    concept = null
  } = {}) => {
    assertFunction(search, "search");
    assertFunction(concept, "concept");
    state.search = search;
    state.concept = concept;
    publish();
    return Object.freeze({
      search_available: typeof search === "function",
      concept_available: typeof concept === "function"
    });
  });

  window.deenAllahClearLocalOmegaProviders = Object.freeze(() => {
    state.search = null;
    state.concept = null;
    publish();
  });

  async function attachIndexedDbStore() {
    const store = window.deenAllahOmegaLocalStore;
    if (!store) return false;

    window.deenAllahRegisterLocalOmegaProviders({
      search: async query => store.searchEvidence(query, { limit: 40 }),
      concept: async ({ term }) => {
        const hits = await store.searchEvidence(term, { limit: 5 });
        return {
          term,
          language: (navigator.language || "ar").split("-")[0].toLowerCase(),
          record: hits[0] || null,
          knowledge: hits[0] ? { definition: hits[0].text } : {},
          methodology: {
            mode: "local_verified_evidence",
            primaryBasis: [],
            sourcePriority: []
          },
          routing: {
            source_classes: hits[0]?.source_id ? [hits[0].source_id] : []
          }
        };
      }
    });
    return true;
  }

  publish();

  window.addEventListener("deenallah:omega-store-ready", () => {
    attachIndexedDbStore().catch(() => {});
  });
  attachIndexedDbStore().catch(() => {});
})();
