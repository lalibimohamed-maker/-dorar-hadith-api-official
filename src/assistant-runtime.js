import { unifiedSearch } from './unified-search.js';
import { createMultimodalSession, normalizeLanguage, speechPolicy, exportRequest } from './multimodal-runtime.js';
import { transcribe, synthesize, quranRecitation, exportMedia } from './media-provider-adapters.js';

/**
 * Orchestrates the public assistant flow without embedding provider secrets.
 * Search remains the source of truth; media providers only render verified
 * input/output around that result.
 */
export async function runAssistantSearch({
  query,
  language = 'ar',
  searchOptions = {},
  providers = {},
  searchFn = unifiedSearch,
  records,
  graph,
} = {}) {
  const normalizedLanguage = normalizeLanguage(language);
  const session = createMultimodalSession({ language: normalizedLanguage });
  const result = await searchFn(query, {
    ...searchOptions,
    responseLocale: normalizedLanguage,
  });

  return {
    session,
    search: result,
    speech: speechPolicy({ language: normalizedLanguage }),
    capabilities: {
      voiceInput: Boolean(providers.speechToText),
      voiceOutput: Boolean(providers.textToSpeech),
      exports: Boolean(providers.export),
      quranRecitation: Boolean(providers.quranRecitation),
    },
  };
}

export async function runVoiceQuestion({ provider, audio, language, searchOptions = {}, searchFn = unifiedSearch } = {}) {
  const normalizedLanguage = normalizeLanguage(language);
  const transcript = await transcribe({ provider, audio, language: normalizedLanguage });
  const query = typeof transcript === 'string' ? transcript : transcript?.text;
  if (!query) throw new Error('Speech provider returned no transcript');
  const response = await runAssistantSearch({ query, language: normalizedLanguage, searchOptions, searchFn });
  return { transcript, ...response };
}

export async function renderAnswerVoice({ provider, answer, language } = {}) {
  return synthesize({ provider, text: answer, language: normalizeLanguage(language) });
}

export async function renderQuranAudio({ provider, surah, ayah } = {}) {
  return quranRecitation({ provider, surah, ayah });
}

export async function exportAssistantSession({ provider, format, sessionId, includeVoice = false, includeVideo = false } = {}) {
  const request = exportRequest({ format, sessionId, includeVoice, includeVideo });
  return exportMedia({ provider, request });
}
