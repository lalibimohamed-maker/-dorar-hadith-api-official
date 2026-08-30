import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CONFIG_PATH = path.resolve('config/display-sharing-federation-2026.json');
const ALLOWED_PROBES = new Set(['miracle-wifid', 'uxplay', 'scrcpy', 'sunshine']);

export function loadDisplaySharingConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

export function probeOptionalBinary(command) {
  if (!ALLOWED_PROBES.has(command)) {
    throw new Error('Probe command is not allowlisted');
  }
  const result = spawnSync(command, ['--version'], {
    encoding: 'utf8',
    timeout: 5000,
    shell: false,
    windowsHide: true,
  });
  return {
    command,
    available: result.status === 0,
    version: result.status === 0
      ? String(result.stdout || result.stderr || '').split(/\r?\n/, 1)[0] || null
      : null,
  };
}

export function listProtocolsForDevice(deviceClass) {
  const config = loadDisplaySharingConfig();
  const ids = config.deviceClasses[deviceClass] || [];
  return config.protocols.filter((protocol) => ids.includes(protocol.id));
}

export function negotiateResolution({ sourceWidth, sourceHeight, sinkWidth, sinkHeight, requestedWidth = null, requestedHeight = null }) {
  for (const value of [sourceWidth, sourceHeight, sinkWidth, sinkHeight, requestedWidth, requestedHeight]) {
    if (value !== null && (!Number.isInteger(value) || value <= 0)) {
      throw new Error('Invalid display dimension');
    }
  }
  if (![sourceWidth, sourceHeight, sinkWidth, sinkHeight].every(Number.isInteger)) {
    return { allowed: false, reason: 'missing-capability-probe' };
  }
  const negotiatedWidth = requestedWidth && requestedHeight
    ? Math.min(sourceWidth, sinkWidth, requestedWidth)
    : Math.min(sourceWidth, sinkWidth);
  const negotiatedHeight = requestedWidth && requestedHeight
    ? Math.min(sourceHeight, sinkHeight, requestedHeight)
    : Math.min(sourceHeight, sinkHeight);
  return {
    allowed: true,
    negotiatedWidth,
    negotiatedHeight,
    derivedFromHigherRequest: Boolean(requestedWidth && (requestedWidth > negotiatedWidth || requestedHeight > negotiatedHeight)),
  };
}

export function validateNativeClaim({ width, height, nativeCapabilityVerified }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Invalid target dimensions');
  }
  if (!nativeCapabilityVerified) {
    return { allowed: false, reason: 'native-capability-not-verified' };
  }
  return { allowed: true, reason: 'native-target-capability-verified' };
}
