import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CONFIG_PATH = path.resolve('config/display-sharing-2026.json');

export function loadDisplaySharingConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

export function probeOptionalBinary(command, args = ['--version']) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 5000 });
  return {
    available: result.status === 0,
    command,
    version: result.status === 0 ? String(result.stdout || result.stderr || '').split(/\r?\n/, 1)[0] || null : null
  };
}

export function engineInventory() {
  return {
    miraclecast: probeOptionalBinary('miracle-wifid'),
    uxplay: probeOptionalBinary('uxplay'),
    scrcpy: probeOptionalBinary('scrcpy'),
    sunshine: probeOptionalBinary('sunshine')
  };
}

export function listProtocolsForDevice(deviceClass) {
  const config = loadDisplaySharingConfig();
  const ids = config.deviceClasses[deviceClass] || [];
  return config.protocols.filter(protocol => ids.includes(protocol.id));
}

export function negotiateResolution({ source, sink, requested }) {
  const values = [source, sink, requested].filter(Number.isInteger);
  if (values.some(value => value <= 0)) throw new Error('Invalid display dimensions');
  if (!Number.isInteger(source) || !Number.isInteger(sink)) {
    return { allowed: false, reason: 'missing-capability-probe' };
  }
  const actualLongEdge = Math.min(source, sink);
  if (!Number.isInteger(requested)) return { allowed: true, maxNegotiatedLongEdge: actualLongEdge };
  return {
    allowed: true,
    requestedLongEdge: requested,
    negotiatedLongEdge: Math.min(requested, actualLongEdge),
    derivedFromHigherRequest: requested > actualLongEdge
  };
}

export function validate24KClaim({ targetWidth, targetHeight, native }) {
  if (!Number.isInteger(targetWidth) || !Number.isInteger(targetHeight) || targetWidth <= 0 || targetHeight <= 0) {
    throw new Error('Invalid target dimensions');
  }
  const longEdge = Math.max(targetWidth, targetHeight);
  if (longEdge < 24000) return { allowed: false, reason: 'target-below-24k' };
  if (!native) return { allowed: false, reason: '24K-is-derived-not-native' };
  return { allowed: true, reason: 'native-target-capability-verified' };
}
