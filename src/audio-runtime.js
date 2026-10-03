export function createAudioRuntime({ vad, endpointing, onEvent = () => {} } = {}) {
  if (typeof vad !== 'function' || typeof endpointing !== 'function') {
    throw new TypeError('vad and endpointing functions are required');
  }
  let speaking = false;
  let interrupted = false;
  return Object.freeze({
    processFrame(frame) {
      const speech = Boolean(vad(frame));
      const boundary = Boolean(endpointing(frame, speech));
      onEvent({ type: 'audio-frame', speech, boundary });
      return { speech, boundary };
    },
    speechStarted() { speaking = true; onEvent({ type: 'speech-start' }); },
    speechEnded() { speaking = false; onEvent({ type: 'speech-end' }); },
    bargeIn() {
      interrupted = true;
      speaking = false;
      onEvent({ type: 'barge-in', cancellationRequired: true });
    },
    clearInterruption() { interrupted = false; },
    get status() { return { speaking, interrupted }; }
  });
}
