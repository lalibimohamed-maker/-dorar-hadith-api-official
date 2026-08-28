import fs from 'node:fs';
import path from 'node:path';

const CONFIG_PATH = path.resolve('config/dhikr-merit-2026.json');

export function loadDhikrConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

export function getDhikrItem(id) {
  const item = loadDhikrConfig().dhikrItems.find((entry) => entry.id === id);
  if (!item) throw new Error(`Unknown dhikr item: ${id}`);
  return structuredClone(item);
}

export function createCounter(id) {
  const item = getDhikrItem(id);
  return {
    id,
    count: 0,
    guidedTarget: item.guidedTarget,
    countIsMaximum: Boolean(item.countIsMaximum),
    phrase: item.phrase ?? item.phraseOptions?.[0] ?? 'ذكر الله'
  };
}

export function incrementCounter(counter, amount = 1) {
  if (!Number.isInteger(amount) || amount < 1) throw new Error('Invalid increment');
  return { ...counter, count: counter.count + amount };
}

export function resetCounter(counter) {
  return { ...counter, count: 0 };
}

export function counterStatus(counter) {
  const target = counter.guidedTarget;
  if (target == null) return { state: 'open', target: null, count: counter.count };
  return {
    state: counter.count >= target ? 'target-reached' : 'in-progress',
    target,
    count: counter.count,
    remaining: Math.max(0, target - counter.count)
  };
}

export function validateDhikrEvidence(item) {
  if (!item?.evidence?.length) return { valid: false, reason: 'missing-evidence' };
  if (!item.evidence.every((e) => e.collection && e.number && e.grade && e.url)) {
    return { valid: false, reason: 'incomplete-evidence' };
  }
  if (item.guidedTarget != null && item.countIsMaximum === true) {
    return { valid: false, reason: 'religious-count-must-not-be-presented-as-maximum' };
  }
  return { valid: true };
}
