const STATES = new Set(['unknown','requested','granted','denied','revoked']);

export function createVoicePermissionLifecycle({ readPermission = async () => 'unknown', requestPermission = async () => 'granted' } = {}) {
  let state = 'unknown';
  return Object.freeze({
    get state() { return state; },
    async refresh() {
      state = String(await readPermission());
      if (!STATES.has(state)) state = 'unknown';
      return state;
    },
    async request() {
      state = 'requested';
      const result = String(await requestPermission());
      state = result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'unknown';
      return state;
    },
    revoke() { state = 'revoked'; return state; }
  });
}
