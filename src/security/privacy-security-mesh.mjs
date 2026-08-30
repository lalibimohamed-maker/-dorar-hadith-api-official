import fs from 'node:fs';
import path from 'node:path';

const CONFIG_PATH = path.resolve('config/privacy-security-mesh-2026.json');

export function loadPrivacySecurityConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

export function evaluateSensorAccess({ sensor, permission, activeSession = false }) {
  const cfg = loadPrivacySecurityConfig();
  if (!['camera', 'microphone'].includes(sensor)) return { allowed: false, reason: 'unknown-sensor' };
  if (permission !== 'granted') return { allowed: false, reason: 'explicit-permission-required' };
  if (!activeSession) return { allowed: false, reason: 'no-active-user-session' };
  return { allowed: true, sessionScoped: cfg.cameraAndMicrophone.mobile.sessionScopedAccessPreferred };
}

export function evaluateBluetoothSession({ paired, discoverable = false, explicitApproval = false, unexpectedDevice = false }) {
  if (!explicitApproval) return { allowed: false, reason: 'explicit-pairing-approval-required' };
  if (!paired) return { allowed: false, reason: 'device-not-paired' };
  if (unexpectedDevice) return { allowed: false, reason: 'unexpected-device-change' };
  return { allowed: true, discoverableDefault: discoverable === false };
}

export function checkSpamRate({ events, nowMs, windowMs = 60000, maxEvents = 30 }) {
  if (!Array.isArray(events) || !Number.isFinite(nowMs)) throw new Error('invalid rate-limit input');
  const recent = events.filter(event => Number.isFinite(event) && event >= nowMs - windowMs && event <= nowMs).length;
  return { allowed: recent < maxEvents, recent, maxEvents, reason: recent < maxEvents ? null : 'rate-limit-exceeded' };
}

export function approveExecutable({ malwareScan = 'unknown', dependencyAudit = 'unknown', staticAnalysis = 'unknown' }) {
  return malwareScan === 'success' && dependencyAudit === 'success' && staticAnalysis === 'success';
}
