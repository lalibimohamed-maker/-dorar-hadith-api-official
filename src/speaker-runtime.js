export function createSpeakerRuntime({ embed, threshold = 0.55 } = {}) {
  if (typeof embed !== 'function') throw new TypeError('embed function is required');
  const profiles = new Map();
  const similarity = (a,b) => {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0;
    let dot=0,aa=0,bb=0;
    for (let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}
    return (aa && bb) ? dot / Math.sqrt(aa*bb) : 0;
  };
  return Object.freeze({
    async enroll(id, audio) {
      if (!id) throw new TypeError('profile id is required');
      const vector = await embed(audio);
      if (!Array.isArray(vector) || !vector.length) throw new Error('empty speaker embedding');
      profiles.set(id, vector);
      return { id, enrolled: true };
    },
    async identify(audio) {
      const vector = await embed(audio);
      let best = null;
      for (const [id, ref] of profiles) {
        const score = similarity(vector, ref);
        if (!best || score > best.score) best = { id, score };
      }
      return best && best.score >= threshold ? best : { id: null, score: best?.score ?? 0 };
    },
    remove(id) { return profiles.delete(id); },
    clear() { profiles.clear(); }
  });
}
