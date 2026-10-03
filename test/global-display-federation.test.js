import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeDisplaySession,
  buildDisplayCapability,
  federationPolicy,
  listDisplayProtocolCandidates,
  negotiateDisplayPath,
  negotiateDisplayResolution,
  probeDisplayCapability
} from '../src/global-display-federation.js';

test('candidate engines stay unverified until a concrete device capability is available', () => {
  const candidates = listDisplayProtocolCandidates();
  assert.equal(candidates.length, 6);
  assert.equal(candidates.every((item) => item.state === 'registered'), true);
  assert.equal(candidates.every((item) => item.installed === false), true);
});

test('installed software is not the same as verified capability', () => {
  const candidate = buildDisplayCapability({ protocol: 'miracast', installed: true, state: 'probed' });
  assert.equal(probeDisplayCapability(candidate).available, false);
  const available = buildDisplayCapability({
    protocol: 'miracast', installed: true, state: 'available', transmit: true, receive: true
  });
  assert.equal(probeDisplayCapability(available).available, true);
});

test('resolution never exceeds the weaker capability', () => {
  assert.equal(negotiateDisplayResolution({ maxResolution: '8K' }, { maxResolution: '4K' }).negotiated, '4K');
  assert.equal(negotiateDisplayResolution({ maxResolution: 'native' }, { maxResolution: '16K' }).negotiated, '16K');
  assert.equal(negotiateDisplayResolution({ maxResolution: '4K' }, { maxResolution: 'native' }).negotiated, '4K');
});

test('unverified capability cannot become a display path', () => {
  const path = negotiateDisplayPath({
    sourceDevice: { id: 'phone', maxResolution: '4K' },
    destinationDevice: { id: 'tv', maxResolution: '4K' },
    capabilities: [buildDisplayCapability({
      protocol: 'cast', installed: true, state: 'probed', transmit: true, receive: true
    })]
  });
  assert.equal(path.allowed, false);
});

test('verified local capability negotiates a path and explicit consent authorizes the session', () => {
  const path = negotiateDisplayPath({
    sourceDevice: { id: 'laptop', maxResolution: '8K' },
    destinationDevice: { id: 'projector', maxResolution: '4K' },
    capabilities: [buildDisplayCapability({
      protocol: 'screen-capture-webrtc', installed: true, state: 'available', transmit: true, receive: true
    })]
  });
  assert.equal(path.allowed, true);
  assert.equal(path.resolution.negotiated, '4K');
  assert.equal(authorizeDisplaySession({
    path, userConsent: false, useDisplayMedia: true, browserSupport: true
  }).allowed, false);
  assert.equal(authorizeDisplaySession({
    path, userConsent: true, useDisplayMedia: true, browserSupport: true
  }).allowed, true);
});

test('browser support, privileged activation and internet exposure are explicit gates', () => {
  const path = { allowed: true };
  assert.equal(authorizeDisplaySession({ path, userConsent: true, useDisplayMedia: true, browserSupport: false }).allowed, false);
  assert.equal(authorizeDisplaySession({ path, userConsent: true, privilegedActivation: true }).allowed, false);
  assert.equal(authorizeDisplaySession({ path, userConsent: true, internetExposure: true }).allowed, false);
});

test('federation cannot become a Corpus or acquisition dependency', () => {
  const policy = federationPolicy();
  assert.equal(policy.corpusMutation, false);
  assert.equal(policy.acquisitionBlocking, false);
  assert.equal(policy.paidApiRequired, false);
  assert.equal(policy.installationPerformedByEngine, false);
});

test('native is only true when both endpoints explicitly advertise native', () => {
  assert.equal(negotiateDisplayResolution({ maxResolution: 'native' }, { maxResolution: 'native' }).native, true);
  assert.equal(negotiateDisplayResolution({ maxResolution: 'native' }, { maxResolution: '4K' }).native, false);
});
