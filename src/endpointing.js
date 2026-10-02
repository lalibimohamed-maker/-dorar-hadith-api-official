export function createEndpointing({
  startSpeechFrames = 2,
  endSilenceFrames = 8
} = {}) {
  if (startSpeechFrames < 1 || endSilenceFrames < 1) throw new RangeError('frame thresholds must be positive');
  let speechFrames=0;
  let silenceFrames=0;
  let active=false;
  return Object.freeze({
    push(speech) {
      if (speech) {
        speechFrames++;
        silenceFrames=0;
        if (!active && speechFrames >= startSpeechFrames) active=true;
      } else {
        silenceFrames++;
        speechFrames=0;
        if (active && silenceFrames >= endSilenceFrames) active=false;
      }
      return {
        speech: Boolean(speech),
        active,
        speechStarted: active && speechFrames === startSpeechFrames,
        speechEnded: !active && silenceFrames === endSilenceFrames
      };
    },
    reset() { speechFrames=0; silenceFrames=0; active=false; }
  });
}
