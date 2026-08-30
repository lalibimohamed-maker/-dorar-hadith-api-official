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

function validateDimension(value) {
  return value !== null && Number.isInteger(value) && value > 0;
}

export function negotiateResolution({ sourceWidth, sourceHeight, sinkWidth, sinkHeight, requestedWidth = null, requestedHeight = null }) {
  for (const value of [sourceWidth, sourceHeight, sinkWidth, sinkHeight, requestedWidth, requestedHeight]) {
    if (value !== null && !validateDimension(value)) {
      throw new Error('Invalid display dimension');
    }
  }
  if (![sourceWidth, sourceHeight, sinkWidth, sinkHeight].every(Number.isInteger)) {
    return { allowed: false, reason: 'missing-capability-probe' };
  }
  if ((requestedWidth === null) !== (requestedHeight === null)) {
    throw new Error('Requested width and height must be supplied together');
  }

  const maxWidth = Math.min(
    sourceWidth,
    sinkWidth,
    requestedWidth ?? Number.POSITIVE_INFINITY,
  );
  const maxHeight = Math.min(
    sourceHeight,
    sinkHeight,
    requestedHeight ?? Number.POSITIVE_INFINITY,
  );
  const sourceAspect = sourceWidth / sourceHeight;

  // Fit the source rectangle inside the negotiated envelope while preserving
  // its native aspect ratio. No crop and no aspect-ratio distortion occur here.
  let negotiatedWidth = Math.floor(maxWidth);
  let negotiatedHeight = Math.floor(negotiatedWidth / sourceAspect);
  if (negotiatedHeight > maxHeight) {
    negotiatedHeight = Math.floor(maxHeight);
    negotiatedWidth = Math.floor(negotiatedHeight * sourceAspect);
  }

  if (negotiatedWidth <= 0 || negotiatedHeight <= 0) {
    return { allowed: false, reason: 'no-compatible-resolution' };
  }

  return {
    allowed: true,
    negotiatedWidth,
    negotiatedHeight,
    aspectRatioPreserved: true,
    derivedFromHigherRequest: Boolean(
      requestedWidth !== null
      && (requestedWidth > negotiatedWidth || requestedHeight > negotiatedHeight),
    ),
  };
}

export function validateNativeClaim({ width, height, nativeCapability }) {
  if (!validateDimension(width) || !validateDimension(height)) {
    throw new Error('Invalid target dimensions');
  }
  if (!nativeCapability || !validateDimension(nativeCapability.width) || !validateDimension(nativeCapability.height)) {
    return { allowed: false, reason: 'native-capability-not-verified' };
  }
  if (nativeCapability.width !== width || nativeCapability.height !== height) {
    return { allowed: false, reason: 'native-geometry-mismatch' };
  }
  return { allowed: true, reason: 'native-target-geometry-verified' };
}
