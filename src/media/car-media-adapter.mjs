import fs from 'node:fs';
import path from 'node:path';

const CONFIG_PATH = path.resolve('config/car-media-2026.json');

export function loadCarMediaConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

export function planCarMedia({ transport, contentType, context = 'parked', nativeResolution = null }) {
  const config = loadCarMediaConfig();
  if (!config.transports[transport]) {
    return { allowed: false, reason: 'unknown-transport' };
  }

  if (contentType === 'audio-quran') {
    if (!config.quranAudio.transports.includes(transport)) return { allowed: false, reason: 'transport-not-supported-for-quran-audio' };
    return {
      allowed: true,
      mode: 'audio-first',
      generatedSpeech: false,
      transport,
      explicitUserActionRequired: config.safety.explicitUserActionForPlayback
    };
  }

  if (contentType === 'video') {
    if (transport === 'bluetooth') return { allowed: false, reason: 'bluetooth-audio-only' };
    if (!config.video.transports.includes(transport)) return { allowed: false, reason: 'transport-not-supported-for-video' };
    if (context === 'driving') return { allowed: false, reason: 'video-blocked-while-driving' };
    return {
      allowed: true,
      mode: 'parked-video',
      nativeResolution,
      preserveMaster: config.video.nativeQualityPolicy === 'preserve-master-and-negotiate-derivative'
    };
  }

  return { allowed: false, reason: 'unsupported-content-type' };
}

export function bluetoothAudioProfiles() {
  return loadCarMediaConfig().transports.bluetooth.profiles;
}
