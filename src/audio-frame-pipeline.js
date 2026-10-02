export function createAudioFramePipeline({ frontEnd, vad, endpointing, onEvent=()=>{} } = {}) {
  if (!frontEnd || typeof frontEnd.process !== 'function') throw new TypeError('frontEnd is required');
  if (typeof vad !== 'function') throw new TypeError('vad is required');
  if (!endpointing || typeof endpointing.push !== 'function') throw new TypeError('endpointing is required');

  return Object.freeze({
    process(samples) {
      const frame=frontEnd.process(samples);
      const speech=Boolean(vad(frame.samples));
      const turn=endpointing.push(speech);
      const result={...frame,speech,turn};
      onEvent(result);
      return result;
    }
  });
}
