const VALID_STATES = new Set([
  'declared','acquired','checksum-verified','license-reviewed','loadable',
  'loaded','warm','inference-verified','unloaded','failed'
]);

export function createModelLifecycleManager({ load, unload } = {}) {
  if (typeof load !== 'function' || typeof unload !== 'function') {
    throw new TypeError('load and unload functions are required');
  }
  const records = new Map();

  return Object.freeze({
    declare(id) {
      if (!id) throw new TypeError('model id is required');
      records.set(id, { id, state: 'declared' });
      return records.get(id);
    },
    transition(id, state, evidence = null) {
      if (!VALID_STATES.has(state)) throw new TypeError(`invalid model state: ${state}`);
      const record = records.get(id);
      if (!record) throw new Error(`unknown model: ${id}`);
      record.state = state;
      if (evidence !== null) record.evidence = evidence;
      return { ...record };
    },
    async ensureLoaded(id) {
      const record = records.get(id);
      if (!record) throw new Error(`unknown model: ${id}`);
      if (record.state === 'warm' || record.state === 'loaded' || record.state === 'inference-verified') return record;
      if (record.state !== 'loadable') {
        throw new Error(`model ${id} is not loadable from state ${record.state}`);
      }
      await load(id);
      record.state = 'loaded';
      return { ...record };
    },
    async release(id) {
      const record = records.get(id);
      if (!record) throw new Error(`unknown model: ${id}`);
      await unload(id);
      record.state = 'unloaded';
      return { ...record };
    },
    get(id) { return records.has(id) ? { ...records.get(id) } : null; }
  });
}
