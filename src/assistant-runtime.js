import { unifiedSearch } from './unified-search.js';
import { createMultimodalSession, normalizeLanguage, speechPolicy, exportRequest } from './multimodal-runtime.js';
import { transcribe, synthesize, quranRecitation, exportMedia } from './media-provider-adapters.js';
import { createAlQuranCloudRecitationProvider } from './quran-recitation-source.js';

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

/**
 * Runs a bounded internal dialogue between two engines using structured messages.
 * Engine output is never routed through the physical microphone.
 */
export async function runEngineDialogue({
  engineA,
  engineB,
  initialMessage,
  language = 'ar',
  maxTurns = 6,
  timeoutMs = 15_000,
  onTurn,
  shouldStop,
} = {}) {
  if (!engineA?.respond || !engineB?.respond) {
    throw new Error('Both dialogue engines must provide a respond(message) function');
  }
  if (!initialMessage) throw new Error('initialMessage is required');
  if (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 8) {
    throw new Error('maxTurns must be an integer between 1 and 8');
  }

  const conversationId = `engine-dialogue-${Date.now()}`;
  const transcript = [];
  let current = {
    conversationId,
    turnId: 0,
    engineId: 'user-proxy',
    role: 'user-proxy',
    content: String(initialMessage),
    language: normalizeLanguage(language),
    provenance: 'user',
  };
  let lastContent = null;

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    if (shouldStop?.()) return { conversationId, status: 'user-stop', turns: transcript };

    const engine = turn % 2 === 1 ? engineA : engineB;
    const engineId = turn % 2 === 1 ? 'engine-a' : 'engine-b';
    const started = Date.now();

    const response = await Promise.race([
      Promise.resolve(engine.respond(current)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('engine dialogue timeout')), timeoutMs)),
    ]);

    const content = typeof response === 'string' ? response : response?.content;
    if (!content) throw new Error(`${engineId} returned no dialogue content`);
    if (content === lastContent) return { conversationId, status: 'loop-detected', turns: transcript };

    const message = {
      conversationId,
      turnId: turn,
      engineId,
      role: engineId,
      content: String(content),
      language: normalizeLanguage(response?.language || language),
      confidence: response?.confidence ?? null,
      timestamp: new Date().toISOString(),
      provenance: response?.provenance || engineId,
      latencyMs: Date.now() - started,
    };
    transcript.push(message);
    lastContent = message.content;
    onTurn?.(message);

    current = message;
  }

  return { conversationId, status: 'max-turns', turns: transcript };
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
