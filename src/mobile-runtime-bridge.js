const STATES = new Set(['idle','permission-request','ready','listening','wake-detected','transcribing','reasoning','speaking','interrupted','stopped','error']);

export function createMobileRuntimeBridge({ onEvent = () => {} } = {}) {
  let state = 'idle';
  function transition(next, detail = {}) {
    if (!STATES.has(next)) throw new TypeError(`invalid bridge state: ${next}`);
    state = next;
    onEvent({ type: next, state, ...detail });
    return state;
  }
  return Object.freeze({
    get state() { return state; },
    requestPermission() { return transition('permission-request'); },
    ready() { return transition('ready'); },
    startListening() { return transition('listening'); },
    wakeDetected() { return transition('wake-detected'); },
    startTranscription() { return transition('transcribing'); },
    startReasoning() { return transition('reasoning'); },
    startSpeaking() { return transition('speaking'); },
    interrupt(reason = 'user-barge-in') { return transition('interrupted', { reason }); },
    stop() { return transition('stopped'); },
    fail(error) { return transition('error', { error: String(error) }); },
    reset() { return transition('idle'); }
  });
}
