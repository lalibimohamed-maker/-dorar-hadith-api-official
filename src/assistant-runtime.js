import { unifiedSearch } from './unified-search.js';
import { createMultimodalSession, normalizeLanguage, speechPolicy, exportRequest } from './multimodal-runtime.js';
import { transcribe, synthesize, quranRecitation, exportMedia } from './media-provider-adapters.js';
import { createAlQuranCloudRecitationProvider } from './quran-recitation-source.js';
import { runGovernedAssistantTurn } from './rechercher-omega-assistant-bridge.js';

function buildOmegaEvidence(search) {
  const evidence = [];
  if (search?.hadith != null) {
    evidence.push({
      source_id: 'dorar-hadith',
      text: JSON.stringify(search.hadith),
      verification: 'source-backed-api-result'
    });
  }
  for (const item of (search?.sourceMatches ?? []).slice(0, 30)) {
    evidence.push({
      source_id: item.id ?? item.source ?? item.work,
      text: [
        item.title,
        item.work,
        item.author,
        item.methodology,
        item.verification,
        item.source
      ].filter(Boolean).join(' | '),
      verification: item.verification ?? 'unknown',
      rights: item.rights ?? 'unknown'
    });
  }
  return evidence;
}

/**
 * Public assistant flow. Search remains the evidence layer; Omega is the
 * governed reasoning/execution layer and is opt-in for execution so clients
 * can preserve the existing search-only contract.
 */
export async function runAssistantSearch({
  query,
  language = 'ar',
  searchOptions = {},
  providers = {},
  searchFn = unifiedSearch,
  records,
  graph,
  useOmega = false,
  executeOmega = false,
  omegaOptions = {},
} = {}) {
  const normalizedLanguage = normalizeLanguage(language);
  const session = createMultimodalSession({ language: normalizedLanguage });
  const result = await searchFn(query, {
    ...searchOptions,
    responseLocale: normalizedLanguage,
  });

  const response = {
    session,
    search: result,
    speech: speechPolicy({ language: normalizedLanguage }),
    capabilities: {
      voiceInput: Boolean(providers.speechToText),
      voiceOutput: Boolean(providers.textToSpeech),
      exports: Boolean(providers.export),
      quranRecitation: Boolean(providers.quranRecitation),
      omega: Boolean(useOmega),
    },
  };

  if (useOmega) {
    response.omega = await runGovernedAssistantTurn({
      query,
      language: normalizedLanguage,
      evidence: buildOmegaEvidence(result),
      output_kind: omegaOptions.output_kind ?? 'analysis',
      requested_models: omegaOptions.requested_models ?? [],
      blocked_models: omegaOptions.blocked_models ?? [],
      availableBackends: omegaOptions.availableBackends ?? [],
      backendHealth: omegaOptions.backendHealth ?? {},
      execute: Boolean(executeOmega),
      search_context: { rights_status: omegaOptions.rights_status ?? 'unknown' },
    });
  }

  return response;
}

export async function runVoiceQuestion({
  provider,
  audio,
  language,
  searchOptions = {},
  searchFn = unifiedSearch,
  useOmega = false,
  executeOmega = false,
  omegaOptions = {},
} = {}) {
  const normalizedLanguage = normalizeLanguage(language);
  const transcript = await transcribe({ provider, audio, language: normalizedLanguage });
  const query = typeof transcript === 'string' ? transcript : transcript?.text;
  if (!query) throw new Error('Speech provider returned no transcript');
  const response = await runAssistantSearch({
    query,
    language: normalizedLanguage,
    searchOptions,
    searchFn,
    useOmega,
    executeOmega,
    omegaOptions,
  });
  return { transcript, ...response };
}

export async function renderAnswerVoice({ provider, answer, language } = {}) {
  return synthesize({ provider, text: answer, language: normalizeLanguage(language) });
}

export async function renderQuranAudio({ provider, surah, ayah, reciter } = {}) {
  const verifiedProvider = provider || createAlQuranCloudRecitationProvider();
  return quranRecitation({ provider: verifiedProvider, surah, ayah, reciter });
}

export async function exportAssistantSession({ provider, format, sessionId, includeVoice = false, includeVideo = false } = {}) {
  const request = exportRequest({ format, sessionId, includeVoice, includeVideo });
  return exportMedia({ provider, request });
}
