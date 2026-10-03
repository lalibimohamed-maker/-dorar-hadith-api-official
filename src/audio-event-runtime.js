export function createAudioEventRuntime({ classify } = {}) {
  if (typeof classify !== 'function') throw new TypeError('classify function is required');
  return Object.freeze({
    async detect(audio) {
      const events = await classify(audio);
      if (!Array.isArray(events)) throw new Error('audio event classifier must return an array');
      return events.map((x) => ({
        label: String(x.label),
        confidence: Number(x.confidence ?? 0),
        startMs: Number(x.startMs ?? 0),
        endMs: Number(x.endMs ?? 0)
      }));
    }
  });
}
