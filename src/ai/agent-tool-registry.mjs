import { unifiedSearch } from '../unified-search.js';

const TOOL_DEFINITIONS = Object.freeze({
  search: {
    id: 'search.unified',
    description: 'Search the existing source-aware knowledge layer and return source-attributed records.',
    acquisitionIndependent: true,
    corpusMutating: false
  }
});

export function listAgentTools() {
  return Object.values(TOOL_DEFINITIONS).map(tool => ({ ...tool }));
}

export async function callAgentTool(toolId, { query, intent = 'general', language = 'ar', signal, searchFn = unifiedSearch } = {}) {
  if (toolId !== TOOL_DEFINITIONS.search.id) {
    const error = new Error(`Unknown agent tool: ${toolId}`);
    error.code = 'AGENT_TOOL_UNKNOWN';
    throw error;
  }
  const search = await searchFn(query, { signal, responseLocale: language, includePotentialMatches: false });
  return {
    toolId,
    intent,
    search,
    policy: { sourceAttributionRequired: true, corpusMutating: false, acquisitionBlocking: false }
  };
}
