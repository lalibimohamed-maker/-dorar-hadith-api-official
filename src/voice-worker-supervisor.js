export function createVoiceWorkerSupervisor({
  start,
  stop = async () => {},
  maxCrashes = 3,
  windowMs = 10 * 60 * 1000,
  backoffMs = [1000, 5000, 15000],
  now = () => Date.now(),
  sleep = async ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  if (typeof start !== 'function') throw new TypeError('start function is required');
  if (typeof stop !== 'function') throw new TypeError('stop function is required');
  const crashTimes = [];
  let instance = null;
  let generation = 0;

  function prune() {
    const cutoff = now() - windowMs;
    while (crashTimes.length && crashTimes[0] < cutoff) crashTimes.shift();
  }

  async function launch(reason = 'initial') {
    prune();
    if (crashTimes.length >= maxCrashes) {
      throw new Error('voice worker crash loop backoff exhausted');
    }
    const currentGeneration = ++generation;
    instance = await start({ generation: currentGeneration, reason });
    return Object.freeze({ generation: currentGeneration, instance });
  }

  async function recover(error) {
    prune();
    crashTimes.push(now());
    await stop(instance);
    instance = null;
    prune();
    if (crashTimes.length >= maxCrashes) {
      throw new Error('voice worker crash loop backoff exhausted');
    }
    const backoffIndex = Math.min(crashTimes.length - 1, backoffMs.length - 1);
    await sleep(Math.max(0, Number(backoffMs[backoffIndex]) || 0));
    return launch('crash-recovery');
  }

  return Object.freeze({
    launch,
    recover,
    get crashCount() { prune(); return crashTimes.length; },
    get generation() { return generation; },
    get running() { return instance !== null; },
    get maxCrashes() { return maxCrashes; },
  });
}
