export function createPunctuationRuntime({ punctuate } = {}) {
  if (typeof punctuate !== 'function') throw new TypeError('punctuate function is required');
  return Object.freeze({
    async execute(text) {
      if (!text?.trim()) throw new TypeError('text is required');
      const result = await punctuate(text);
      if (typeof result !== 'string' || !result.trim()) throw new Error('punctuation returned empty text');
      return result;
    }
  });
}
