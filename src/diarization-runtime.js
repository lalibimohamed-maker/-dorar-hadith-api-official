export function createDiarizationRuntime({ segment = null } = {}) {
  return Object.freeze({
    available: typeof segment === 'function',
    async diarize(audio) {
      if (typeof segment !== 'function') throw new Error('diarization runtime is not loaded');
      const result = await segment(audio);
      if (!Array.isArray(result)) throw new Error('diarization must return an array of speaker segments');
      return result.map((x) => ({
        speaker: String(x.speaker),
        startMs: Number(x.startMs),
        endMs: Number(x.endMs),
        confidence: Number(x.confidence ?? 0)
      }));
    }
  });
}
