/**
 * Global cross-device display federation.
 *
 * Contract-only capability discovery, route negotiation and session
 * authorization. Never installs software, exposes screens publicly,
 * activates privileged services silently, or mutates Corpus/content.
 */

export const DISPLAY_PROTOCOLS = Object.freeze([
  'miracast', 'airplay', 'cast', 'screen-capture-webrtc', 'scrcpy', 'sunshine-moonlight'
]);

export const DISPLAY_CAPABILITY_STATES = Object.freeze([
  'registered', 'probed', 'available', 'unsupported', 'unavailable'
]);

export const RESOLUTION_CLASSES = Object.freeze([
  'native', '4K', '8K', '10K', '12K', '16K', '24K', 'future'
]);

const RESOLUTION_RANK = Object.freeze({
  'native': Number.MAX_SAFE_INTEGER,
  '4K': 4,
  '8K': 8,
  '10K': 10,
  '12K': 12,
  '16K': 16,
  '24K': 24,
  'future': Number.MAX_SAFE_INTEGER
});

const CANDIDATES = Object.freeze([
  ['miracast', 'Miracast/MiracleCast'],
  ['airplay', 'AirPlay/UxPlay'],
  ['cast', 'Cast adapter'],
  ['screen-capture-webrtc', 'Screen Capture/WebRTC'],
  ['scrcpy', 'scrcpy'],
  ['sunshine-moonlight', 'Sunshine/Moonlight']
]);

function validResolution(value) {
  return RESOLUTION_CLASSES.includes(String(value || ''));
}

function rank(value) {
  return RESOLUTION_RANK[String(value || 'future')] ?? 0;
}

function localCapability(capability) {
  return capability?.localOnly !== false && (capability?.transport === 'local' || !capability?.transport);
}

export function listDisplayProtocolCandidates() {
  return CANDIDATES.map(([id, family]) => ({
    id, family, state: 'registered', installed: false, capabilityVerified: false
  }));
}

export function buildDisplayCapability({
  protocol, state = 'registered', installed = false, version = null,
  receive = false, transmit = false, maxResolution = 'native',
  browserSupport = null, permissionRequired = true, localOnly = true
} = {}) {
  if (!DISPLAY_PROTOCOLS.includes(protocol)) throw new TypeError('unsupported display protocol');
  if (!DISPLAY_CAPABILITY_STATES.includes(state)) throw new TypeError('invalid display capability state');
  if (!validResolution(maxResolution)) throw new TypeError('invalid resolution capability');
  return Object.freeze({
    protocol, state, installed: installed === true, version,
    receive: receive === true, transmit: transmit === true, maxResolution,
    browserSupport, permissionRequired: permissionRequired !== false,
    localOnly: localOnly !== false, transport: 'local',
    capabilityVerified: state === 'available'
  });
}

export function probeDisplayCapability(capability = {}) {
  if (!DISPLAY_PROTOCOLS.includes(capability.protocol)) {
    return Object.freeze({ state: 'unavailable', available: false, reason: 'protocol_missing' });
  }
  const available = capability.state === 'available' &&
    capability.installed === true &&
    localCapability(capability) &&
    (capability.receive === true || capability.transmit === true);
  return Object.freeze({
    state: available ? 'available' : (capability.installed ? 'unsupported' : 'unavailable'),
    available,
    capabilityVerified: available
  });
}

export function negotiateDisplayResolution(source = {}, destination = {}) {
  const sourceResolution = source.maxResolution || 'future';
  const destinationResolution = destination.maxResolution || 'future';
  if (!validResolution(sourceResolution) || !validResolution(destinationResolution)) {
    throw new TypeError('invalid source or destination resolution');
  }
  const negotiated = rank(sourceResolution) <= rank(destinationResolution)
    ? sourceResolution
    : destinationResolution;
  return Object.freeze({
    source: sourceResolution,
    destination: destinationResolution,
    negotiated,
    native: sourceResolution === 'native' && destinationResolution === 'native',
    cappedBy: rank(sourceResolution) <= rank(destinationResolution) ? 'source' : 'destination'
  });
}

export function negotiateDisplayPath({
  sourceDevice, destinationDevice, capabilities = [], preferredProtocol = null
} = {}) {
  const source = sourceDevice || {};
  const destination = destinationDevice || {};
  const candidates = capabilities.filter((capability) =>
    capability?.state === 'available' &&
    capability.capabilityVerified === true &&
    capability.installed === true &&
    localCapability(capability) &&
    capability.transmit === true &&
    capability.receive === true
  );
  const filtered = preferredProtocol
    ? candidates.filter((capability) => capability.protocol === preferredProtocol)
    : candidates;
  if (!source.id || !destination.id || !filtered.length) {
    return Object.freeze({
      allowed: false,
      reason: 'no_verified_local_display_path',
      acquisitionBlocking: false,
      corpusMutation: false
    });
  }
  return Object.freeze({
    allowed: true,
    protocol: filtered[0].protocol,
    resolution: negotiateDisplayResolution(source, destination),
    sourceDeviceId: source.id,
    destinationDeviceId: destination.id,
    localOnly: true,
    acquisitionBlocking: false,
    corpusMutation: false
  });
}

export function authorizeDisplaySession({
  path, userConsent = false, browserSupport = true,
  useDisplayMedia = false, localDiscovery = true,
  privilegedActivation = false, internetExposure = false
} = {}) {
  const failures = [];
  if (!path?.allowed) failures.push('verified_display_path_required');
  if (userConsent !== true) failures.push('explicit_user_consent_required');
  if (useDisplayMedia && browserSupport !== true) failures.push('getDisplayMedia_browser_unsupported');
  if (localDiscovery !== true) failures.push('local_discovery_required');
  if (privilegedActivation === true) failures.push('silent_privileged_activation_forbidden');
  if (internetExposure === true) failures.push('automatic_public_screen_exposure_forbidden');
  return Object.freeze({
    allowed: failures.length === 0,
    failures,
    requiresUserConsent: true,
    browserPermissionModel: useDisplayMedia ? 'getDisplayMedia-user-permission' : 'protocol-specific',
    internetExposure: false,
    silentActivation: false,
    corpusMutation: false,
    acquisitionBlocking: false
  });
}

export function federationPolicy() {
  return Object.freeze({
    freeFirst: true,
    paidApiRequired: false,
    localDiscoveryPreferred: true,
    remoteScreenExposureDefault: false,
    installationPerformedByEngine: false,
    privilegedActivationPerformedByEngine: false,
    corpusMutation: false,
    acquisitionBlocking: false,
    scientificAuthorityGranted: false,
    resolutionPolicy: 'minimum-verified-capability',
    nativeClaimRequiresBothNative: true,
    rebuiltOutputIsNeverNativeByInference: true
  });
}
