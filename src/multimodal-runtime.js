const DEFAULTS = Object.freeze({
  fallbackLanguage: 'ar',
  quranReciter: 'Saad Al-Ghamdi',
  quranVoiceMode: 'arabic-recitation-only',
  supportedDirections: ['ltr', 'rtl'],
  exportFormats: ['mp3', 'mp4-4k', 'pdf', 'docx'],
  deviceCapabilities: ['microphone', 'speakers', 'files', 'calls', 'notifications', 'settings'],
  platforms: ['web', 'ios', 'android'],
});

const RTL_LANGUAGE_PREFIXES = new Set(['ar', 'fa', 'he', 'ps', 'ur', 'sd', 'ug', 'yi']);
const RELIGIOUS_CONTENT_KINDS = new Set([
  'quran',
  'hadith',
  'tafsir',
  'sirah',
  'fiqh',
  'usul',
  'rijal',
  'aqidah',
  'tajweed',
]);

/**
 * Runtime contracts for web/iOS/Android multimodal clients.
 *
 * The runtime is policy-only: it never invents a provider, source, permission,
 * citation, or media attribution. Provider/client adapters supply concrete
 * capabilities and platform permissions.
 */

export function normalizeLanguage(language) {
  if (typeof language !== 'string' || !language.trim()) return DEFAULTS.fallbackLanguage;
  try {
    return Intl.getCanonicalLocales(language.trim())[0] ?? DEFAULTS.fallbackLanguage;
  } catch {
    return DEFAULTS.fallbackLanguage;
  }
}

export function detectLanguageState({ text = '', detectedLanguage, settingsLanguage } = {}) {
  const source = typeof detectedLanguage === 'string' && detectedLanguage.trim()
    ? detectedLanguage
    : settingsLanguage;
  const language = normalizeLanguage(source);
  return {
    language,
    source: typeof detectedLanguage === 'string' && detectedLanguage.trim()
      ? 'detected'
      : 'settings-fallback',
    originalText: String(text ?? ''),
  };
}

export function directionForLanguage(language, explicitDirection) {
  if (explicitDirection === 'rtl' || explicitDirection === 'ltr') return explicitDirection;
  const canonical = normalizeLanguage(language);
  const base = canonical.toLowerCase().split('-')[0];
  const script = canonical.split('-').find(part => part.length === 4)?.toLowerCase();
  return script === 'arab' || RTL_LANGUAGE_PREFIXES.has(base) ? 'rtl' : 'ltr';
}

export function keyboardProfile(language, options = {}) {
  const normalized = normalizeLanguage(language);
  return {
    language: normalized,
    layout: options.layout ?? 'auto',
    direction: directionForLanguage(normalized, options.direction),
    imeComposition: options.imeComposition !== false,
    customLayouts: options.customLayouts !== false,
    settingsLanguage: normalizeLanguage(options.settingsLanguage ?? normalized),
    voiceInput: {
      enabled: options.voiceInput !== false,
      language: normalized,
      provider: options.voiceProvider ?? 'browser-or-configured-provider',
      platformApi: options.platformApi ?? 'browser-or-platform-speech-api',
    },
  };
}

export function discoverProviderCapabilities(providers = [], requestedLanguage) {
  const language = normalizeLanguage(requestedLanguage);
  return providers
    .filter(provider => provider && provider.verified === true && typeof provider.id === 'string')
    .map(provider => {
      const languages = Array.isArray(provider.languages)
        ? provider.languages.map(normalizeLanguage)
        : [];
      const supportsLanguage = provider.languages == null || languages.includes(language);
      return {
        id: provider.id,
        kind: provider.kind ?? 'speech',
        verified: true,
        supportsLanguage,
        capabilities: Array.isArray(provider.capabilities) ? [...provider.capabilities] : [],
        languages,
        authorization: provider.authorization ?? 'unspecified',
      };
    });
}

function findVerifiedCapability(providers, capability, language) {
  const normalized = normalizeLanguage(language);
  return discoverProviderCapabilities(providers, normalized).find(provider =>
    provider.capabilities.includes(capability) && provider.supportsLanguage
  ) ?? null;
}

export function speechCapability({ language, providers = [], mode = 'synthesis' } = {}) {
  const normalized = normalizeLanguage(language);
  const provider = findVerifiedCapability(providers, mode, normalized);
  if (!provider) {
    return {
      available: false,
      language: normalized,
      mode,
      provider: null,
      reason: `No verified provider advertises ${mode} for ${normalized}; do not silently switch languages.`,
      fallback: 'ui-notice-and-explicit-fallback',
    };
  }
  return {
    available: true,
    language: normalized,
    mode,
    provider: provider.id,
    verified: true,
  };
}

export function speechPolicy({ language, isQuran = false, providers = [] } = {}) {
  const normalized = normalizeLanguage(language);
  if (isQuran) {
    return {
      mode: DEFAULTS.quranVoiceMode,
      language: 'ar',
      reciter: DEFAULTS.quranReciter,
      translateRecitation: false,
      capability: null,
    };
  }
  return {
    mode: 'localized-answer',
    language: normalized,
    reciter: null,
    translateRecitation: false,
    capability: speechCapability({ language: normalized, providers, mode: 'synthesis' }),
  };
}

export function quranRecitationOffer({
  providers = [],
  reciter = DEFAULTS.quranReciter,
  action = 'playback',
} = {}) {
  const provider = providers.find(candidate =>
    candidate
      && candidate.verified === true
      && candidate.authorized === true
      && candidate.kind === 'audio'
      && Array.isArray(candidate.reciters)
      && candidate.reciters.includes(reciter)
      && (candidate.languages == null || candidate.languages.map(normalizeLanguage).includes('ar'))
      && Array.isArray(candidate.capabilities)
      && candidate.capabilities.includes(action)
  );

  if (!provider) {
    return {
      available: false,
      language: 'ar',
      reciter,
      action,
      reason: 'No verified and authorized Quran audio source is available for this action.',
    };
  }

  return {
    available: true,
    language: 'ar',
    reciter,
    action,
    provider: provider.id,
    verified: true,
    authorized: true,
  };
}

export function createMultimodalSession(options = {}) {
  const languageState = detectLanguageState({
    text: options.originalUserText ?? options.text ?? '',
    detectedLanguage: options.detectedLanguage ?? options.language,
    settingsLanguage: options.settingsLanguage ?? DEFAULTS.fallbackLanguage,
  });
  const direction = directionForLanguage(languageState.language, options.direction);

  const session = {
    schemaVersion: 2,
    sessionId: options.sessionId ?? null,
    input: {
      modes: ['text', 'keyboard', 'voice'],
      originalUserText: languageState.originalText,
      detectedLanguage: languageState.language,
      languageSource: languageState.source,
      text: true,
      voice: true,
      keyboard: true,
    },
    language: languageState.language,
    direction,
    settings: {
      language: normalizeLanguage(options.settingsLanguage ?? languageState.language),
    },
    output: {
      text: true,
      voice: {
        requestedLanguage: languageState.language,
        policy: 'localized-answer',
        capability: speechCapability({
          language: languageState.language,
          providers: options.providers ?? [],
          mode: 'synthesis',
        }),
      },
      quranRecitation: {
        language: 'ar',
        reciter: DEFAULTS.quranReciter,
        policy: DEFAULTS.quranVoiceMode,
        playback: quranRecitationOffer({
          providers: options.providers ?? [],
          reciter: DEFAULTS.quranReciter,
          action: 'playback',
        }),
        download: quranRecitationOffer({
          providers: options.providers ?? [],
          reciter: DEFAULTS.quranReciter,
          action: 'download',
        }),
      },
    },
    keyboard: keyboardProfile(languageState.language, {
      ...options,
      settingsLanguage: options.settingsLanguage ?? languageState.language,
      direction,
    }),
    exports: DEFAULTS.exportFormats.map(format => ({
      format,
      available: false,
      verifiedOnly: true,
      reason: 'Binary generation requires a configured and verified provider/client.',
    })),
    provenance: normalizeProvenance(options.provenance),
  };

  return Object.freeze(session);
}

export function buildSessionArtifact({
  session,
  kind,
  payload = null,
  provenance = session?.provenance,
} = {}) {
  if (!session || typeof session !== 'object') throw new Error('session is required');
  if (!kind || typeof kind !== 'string') throw new Error('artifact kind is required');

  return {
    schemaVersion: 1,
    sessionId: session.sessionId ?? null,
    kind,
    originalQuestion: session.input?.originalUserText ?? '',
    detectedLanguage: session.input?.detectedLanguage ?? session.language,
    answerLanguage: session.language,
    citations: session.provenance.citations,
    sourceReferences: session.provenance.sourceReferences,
    provenance: normalizeProvenance(provenance),
    religiousSource: false,
    payload,
  };
}

export function normalizeProvenance(provenance = {}) {
  const citations = Array.isArray(provenance?.citations) ? provenance.citations.map(String) : [];
  const sourceReferences = Array.isArray(provenance?.sourceReferences)
    ? provenance.sourceReferences.map(String)
    : [];

  return {
    citations,
    sourceReferences,
    sourceVerified: provenance?.sourceVerified === true,
    mediaSourceVerified: provenance?.mediaSourceVerified === true,
    attribution: provenance?.attribution ?? null,
  };
}

export function exportRequest({
  format,
  sessionId,
  includeVoice = false,
  includeVideo = false,
  originalQuestion = '',
  answerLanguage,
  citations = [],
  sourceReferences = [],
  provenance = {},
} = {}) {
  if (!DEFAULTS.exportFormats.includes(format)) {
    throw new Error(`Unsupported export format: ${format}`);
  }
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('sessionId is required');
  }
  if (includeVideo && format !== 'mp4-4k') {
    throw new Error('includeVideo requires mp4-4k format');
  }
  if (includeVoice && !['mp3', 'mp4-4k'].includes(format)) {
    throw new Error('includeVoice is supported only for mp3 or mp4-4k');
  }

  return {
    sessionId,
    format,
    includeVoice: Boolean(includeVoice),
    includeVideo: Boolean(includeVideo),
    verifiedOnly: true,
    status: 'requires-provider',
    originalQuestion: String(originalQuestion ?? ''),
    answerLanguage: normalizeLanguage(answerLanguage),
    citations: Array.isArray(citations) ? citations.map(String) : [],
    sourceReferences: Array.isArray(sourceReferences) ? sourceReferences.map(String) : [],
    provenance: normalizeProvenance(provenance),
  };
}

export function validateExportManifest(manifest = {}) {
  const required = ['sessionId', 'format', 'originalQuestion', 'answerLanguage', 'citations', 'sourceReferences'];
  const missing = required.filter(key => manifest[key] == null);
  if (missing.length) return { valid: false, missing };

  if (!DEFAULTS.exportFormats.includes(manifest.format)) {
    return { valid: false, reason: `Unsupported export format: ${manifest.format}` };
  }

  if (manifest.verifiedOnly !== true) {
    return { valid: false, reason: 'Exports must remain verifiedOnly.' };
  }

  if (manifest.format === 'mp4-4k' && manifest.fabricatedQuranRecitation === true) {
    return { valid: false, reason: 'Video export cannot fabricate a Quran recitation.' };
  }

  if (manifest.fabricatedCitation === true || manifest.fabricatedSource === true || manifest.fabricatedAttribution === true) {
    return { valid: false, reason: 'Exports cannot fabricate citations, sources, or visual attribution.' };
  }

  return { valid: true };
}

export function deviceCapabilityRequest({
  platform,
  capability,
  permissionGranted = false,
  userOptIn = false,
} = {}) {
  const normalizedPlatform = String(platform ?? '').toLowerCase();
  const normalizedCapability = String(capability ?? '').toLowerCase();

  if (!DEFAULTS.platforms.includes(normalizedPlatform)) {
    return { allowed: false, reason: 'Unsupported platform; client adapter required.' };
  }
  if (!DEFAULTS.deviceCapabilities.includes(normalizedCapability)) {
    return { allowed: false, reason: 'Unsupported device capability.' };
  }
  if (!userOptIn) {
    return { allowed: false, reason: 'Explicit user opt-in is required.' };
  }
  if (!permissionGranted) {
    return { allowed: false, reason: 'Operating-system permission is required.' };
  }

  return {
    allowed: true,
    platform: normalizedPlatform,
    capability: normalizedCapability,
    permissionGated: true,
  };
}

export function sourceArtifactPolicy({ sourceType, contentKind } = {}) {
  const isReligiousSource = contentKind && RELIGIOUS_CONTENT_KINDS.has(contentKind);
  if (sourceType === 'external-media') {
    return {
      religiousSource: false,
      reason: 'External media remains a session artifact unless independently registered and verified as a religious source.',
    };
  }
  return {
    religiousSource: Boolean(isReligiousSource),
    reason: isReligiousSource
      ? 'Religious-source status depends on source registry and provenance verification.'
      : 'No religious-source status is inferred.',
  };
}

export const SUPPORTED_EXPORT_FORMATS = Object.freeze([...DEFAULTS.exportFormats]);
export const SUPPORTED_DEVICE_CAPABILITIES = Object.freeze([...DEFAULTS.deviceCapabilities]);
export const SUPPORTED_PLATFORMS = Object.freeze([...DEFAULTS.platforms]);
