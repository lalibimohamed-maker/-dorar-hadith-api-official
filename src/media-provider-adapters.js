/**
 * Provider adapters for speech and media export.
 *
 * Providers are injected by the application layer. This module never stores
 * credentials, invents URLs, or claims a capability without a provider.
 */

const SUPPORTED = Object.freeze({
  speechToText: 'speech-to-text',
  textToSpeech: 'text-to-speech',
  quranRecitation: 'quran-recitation',
  export: 'media-export',
});

function requireProvider(provider, capability) {
  if (!provider || typeof provider !== 'object') {
    throw new Error(`A verified provider is required for ${capability}`);
  }
  if (typeof provider.supports !== 'function' || typeof provider.execute !== 'function') {
    throw new Error(`Invalid provider adapter for ${capability}`);
  }
  if (!provider.supports(capability)) {
    throw new Error(`Provider does not support ${capability}`);
  }
  return provider;
}

export function createMediaProviderRegistry(providers = {}) {
  return Object.freeze({
    speechToText: providers.speechToText ?? null,
    textToSpeech: providers.textToSpeech ?? null,
    quranRecitation: providers.quranRecitation ?? null,
    export: providers.export ?? null,
  });
}

export async function transcribe({ provider, audio, language }) {
  const adapter = requireProvider(provider, SUPPORTED.speechToText);
  return adapter.execute({ audio, language });
}

export async function synthesize({ provider, text, language }) {
  const adapter = requireProvider(provider, SUPPORTED.textToSpeech);
  return adapter.execute({ text, language });
}

export async function quranRecitation({ provider, surah, ayah, reciter = 'Saad Al-Ghamdi' }) {
  const adapter = requireProvider(provider, SUPPORTED.quranRecitation);
  return adapter.execute({
    surah,
    ayah,
    language: 'ar',
    reciter,
    verifiedOnly: true,
  });
}

export async function exportMedia({ provider, request }) {
  const adapter = requireProvider(provider, SUPPORTED.export);
  return adapter.execute({ ...request, verifiedOnly: true });
}

export { SUPPORTED as MEDIA_CAPABILITIES };
