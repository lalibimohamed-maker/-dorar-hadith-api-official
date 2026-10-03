const PLATFORM_ADAPTERS = Object.freeze({
  ios: Object.freeze({ family: 'apple', invocation: 'app-intents', settings: 'siri-shortcuts' }),
  android: Object.freeze({ family: 'android', invocation: 'voice-interaction-service', settings: 'assistant-role' }),
  harmonyOS: Object.freeze({ family: 'harmony', invocation: 'xiaoyi-skill-agent', settings: 'system-ai-entry' }),
  web: Object.freeze({ family: 'web', invocation: 'browser-voice', settings: 'browser-permissions' }),
  androidTV: Object.freeze({ family: 'android', parent: 'android', profile: 'tv' }),
  wearOS: Object.freeze({ family: 'android', parent: 'android', profile: 'wearable' }),
  harmonyTV: Object.freeze({ family: 'harmony', parent: 'harmonyOS', profile: 'tv' }),
  harmonyWearable: Object.freeze({ family: 'harmony', parent: 'harmonyOS', profile: 'wearable' }),
  automotive: Object.freeze({ family: 'platform', invocation: 'vehicle-assistant-adapter', settings: 'vehicle-assistant' }),
  smartHome: Object.freeze({ family: 'platform', invocation: 'local-device-gateway', settings: 'hub-assistant' })
});

export function listPlatformVoiceAdapters() {
  return Object.entries(PLATFORM_ADAPTERS).map(([id, value]) => ({ id, ...value }));
}

export function getPlatformVoiceAdapter(platform) {
  const key = String(platform || '');
  const adapter = PLATFORM_ADAPTERS[key];
  if (!adapter) throw new RangeError('Unknown Al-Huda platform: ' + key);
  return Object.freeze({ id: key, ...adapter });
}
