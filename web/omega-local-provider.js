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

  publish();
})();
