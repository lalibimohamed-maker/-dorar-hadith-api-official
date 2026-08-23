const DEFAULTS = Object.freeze({
  fallbackLanguage: 'ar',
  quranReciter: 'Saad Al-Ghamdi',
  quranVoiceMode: 'arabic-recitation-only',
  supportedDirections: ['ltr', 'rtl'],
  exportFormats: ['mp3', 'mp4-4k', 'pdf', 'docx'],
});

/**
 * Multimodal policy/runtime helpers shared by a web or mobile client.
 * This module deliberately does not invent speech/audio sources. A client
 * must provide a verified provider for transcription, synthesis and media
 * export before claiming that a capability is available.
 */
export function createMultimodalSession(options = {}) {
  const language = normalizeLanguage(options.language ?? DEFAULTS.fallbackLanguage);
  const direction = options.direction === 'rtl' ? 'rtl' : 'ltr';

  return {
    language,
    direction,
    input: {
      text: true,
      voice: true,
      keyboard: true,
    },
    output: {
      text: true,
      voice: true,
      quranRecitation: {
        language: 'ar',
        reciter: DEFAULTS.quranReciter,
        policy: DEFAULTS.quranVoiceMode,
      },
    },
    exports: DEFAULTS.exportFormats.map(format => ({
      format,
      available: false,
      reason: 'Requires a configured and verified media/export provider.',
    })),
  };
}

export function normalizeLanguage(language) {
  if (typeof language !== 'string' || !language.trim()) return DEFAULTS.fallbackLanguage;
  try {
    return Intl.getCanonicalLocales(language.trim())[0];
  } catch {
    return DEFAULTS.fallbackLanguage;
  }
}

export function keyboardProfile(language, options = {}) {
  return {
    language: normalizeLanguage(language),
    layout: options.layout ?? 'auto',
    direction: options.direction === 'rtl' ? 'rtl' : 'ltr',
    voiceInput: {
      enabled: options.voiceInput !== false,
      language: normalizeLanguage(language),
      provider: options.voiceProvider ?? 'browser-or-configured-provider',
    },
    composition: true,
    customLayouts: true,
  };
}

export function speechPolicy({ language, isQuran = false } = {}) {
  const normalized = normalizeLanguage(language);
  if (isQuran) {
    return {
      mode: DEFAULTS.quranVoiceMode,
      language: 'ar',
      reciter: DEFAULTS.quranReciter,
      translateRecitation: false,
    };
  }
  return {
    mode: 'localized-answer',
    language: normalized,
    reciter: null,
    translateRecitation: false,
  };
}

export function exportRequest({ format, sessionId, includeVoice = false, includeVideo = false } = {}) {
  if (!DEFAULTS.exportFormats.includes(format)) {
    throw new Error(`Unsupported export format: ${format}`);
  }
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('sessionId is required');
  }
  return {
    sessionId,
    format,
    includeVoice: Boolean(includeVoice),
    includeVideo: Boolean(includeVideo),
    verifiedOnly: true,
    status: 'requires-provider',
  };
}

export const SUPPORTED_EXPORT_FORMATS = Object.freeze([...DEFAULTS.exportFormats]);
