import fs from 'node:fs';
import path from 'node:path';

const CONFIG_PATH = path.resolve('config/rechercher-learning-gap-register-2026.json');

export const PRIORITIES = Object.freeze(['P0','P1','P2','P3','P4']);
export const STATUSES = Object.freeze([
  'implemented-in-p0',
  'implemented-in-v3',
  'partial-contract',
  'partial-existing',
  'planned'
]);

export function loadLearningGapRegister() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

export function validateLearningGapRegister(register = loadLearningGapRegister()) {
  const errors = [];
  if (register.status !== 'implementation-register') errors.push('register must be an implementation register');
  if (register.nonNegotiable?.acquisitionBlockerAllowed !== false) errors.push('acquisition blockers must be forbidden');
  if (register.nonNegotiable?.learningMayNotBlockPdfAcquisition !== true) errors.push('learning must not block PDF acquisition');
  if (!Array.isArray(register.gaps) || register.gaps.length !== 17) errors.push('expected 17 registered gaps');

  const ids = new Set();
  for (const gap of register.gaps ?? []) {
    if (!gap.id || ids.has(gap.id)) errors.push('gap IDs must be present and unique');
    ids.add(gap.id);
    if (!PRIORITIES.includes(gap.priority)) errors.push(gap.id + ': unsupported priority');
    if (!STATUSES.includes(gap.status)) errors.push(gap.id + ': unsupported status');
    if (gap.acquisitionBlocker !== false) errors.push(gap.id + ': acquisitionBlocker must be false');
    if (!gap.gap || !gap.capability) errors.push(gap.id + ': gap/capability required');
  }

  const p0 = register.gaps?.filter(g => g.priority === 'P0') ?? [];
  if (p0.length !== 4) errors.push('P0 must contain 4 gaps');

  return { ok: errors.length === 0, errors };
}

export function gapsByPriority(priority, register = loadLearningGapRegister()) {
  if (!PRIORITIES.includes(priority)) throw new Error('unsupported priority: ' + priority);
  return register.gaps.filter(gap => gap.priority === priority);
}

export function assertAcquisitionIndependent(register = loadLearningGapRegister()) {
  const validation = validateLearningGapRegister(register);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const blockers = register.gaps.filter(gap => gap.acquisitionBlocker !== false);
  if (blockers.length) throw new Error('learning gap register contains acquisition blockers');
  return true;
}

export function summarizeLearningGaps(register = loadLearningGapRegister()) {
  return Object.fromEntries(PRIORITIES.map(priority => [
    priority,
    register.gaps.filter(g => g.priority === priority).map(g => ({
      id: g.id,
      gap: g.gap,
      status: g.status
    }))
  ]));
}
