export function createAudioFrontEnd({
  targetPeak = 0.85,
  clippingThreshold = 0.995,
  noiseFloor = 0.003
} = {}) {
  return Object.freeze({
    process(samples) {
      if (!samples || typeof samples.length !== 'number') throw new TypeError('samples are required');
      const out = new Float32Array(samples.length);
      let peak = 0;
      let rmsAcc = 0;
      for (const sample of samples) {
        const x = Number(sample) || 0;
        peak = Math.max(peak, Math.abs(x));
        rmsAcc += x * x;
      }
      const rms = samples.length ? Math.sqrt(rmsAcc / samples.length) : 0;
      const gain = peak > 0 ? Math.min(targetPeak / peak, 4) : 1;
      for (let i=0;i<samples.length;i++) {
        let x=(Number(samples[i])||0)*gain;
        if (Math.abs(x) < noiseFloor) x=0;
        out[i]=Math.max(-1,Math.min(1,x));
      }
      return {
        samples: out,
        peak,
        rms,
        clipped: peak >= clippingThreshold,
        gain
      };
    }
  });
}
