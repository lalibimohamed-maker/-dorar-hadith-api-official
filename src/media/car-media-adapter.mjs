import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CONFIG_PATH = path.resolve('config/car-media-2026.json');

export function loadCarMediaConfig() { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }

export function probePlaybackEngines() {
  const config = loadCarMediaConfig();
  const commands = { GStreamer: 'gst-launch-1.0', mpv: 'mpv' };
  return Object.fromEntries(config.playbackEngines.map(engine => {
    const command = commands[engine.name];
    if (!command) return [engine.name, { available: false, command: null, version: null }];
    const result = spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 5000 });
    return [engine.name, { available: result.status === 0, command, version: result.status === 0 ? String(result.stdout || result.stderr || '').split(/\r?\n/, 1)[0] || null : null }];
  }));
}

export function planCarMedia({ transport, contentType, context = 'parked', nativeResolution = null, engine = 'platform-native' }) {
  const config = loadCarMediaConfig();
  if (!config.transports[transport]) return { allowed: false, reason: 'unknown-transport' };
  if (contentType === 'audio-quran') {
    if (!config.quranAudio.transports.includes(transport)) return { allowed: false, reason: 'transport-not-supported-for-quran-audio' };
    if (engine !== 'platform-native' && !config.playbackEngines.some(item => item.name === engine)) return { allowed: false, reason: 'unknown-playback-engine' };
    return { allowed: true, mode: 'audio-first', generatedSpeech: false, transport, engine, preserveOriginal: config.quranAudio.nativeAudioPreserved, explicitUserActionRequired: config.safety.explicitUserActionForPlayback };
  }
  if (contentType === 'video') {
    if (transport === 'bluetooth') return { allowed: false, reason: 'bluetooth-audio-only' };
    if (!config.video.transports.includes(transport)) return { allowed: false, reason: 'transport-not-supported-for-video' };
    if (context === 'driving') return { allowed: false, reason: 'video-blocked-while-driving' };
    if (engine !== 'platform-native' && !config.playbackEngines.some(item => item.name === engine)) return { allowed: false, reason: 'unknown-playback-engine' };
    return { allowed: true, mode: 'parked-video', engine, nativeResolution, preserveMaster: config.video.nativeQualityPolicy === 'preserve-master-and-negotiate-derivative' };
  }
  return { allowed: false, reason: 'unsupported-content-type' };
}

export function bluetoothAudioProfiles() { return loadCarMediaConfig().transports.bluetooth.profiles; }
