/**
 * Extensible self-hosted OCR engine pool.
 *
 * Engines are adapters, not authorities. The source page remains immutable.
 * No engine is allowed to silently rewrite an approved text layer.
 */

const engines = new Map();

export function registerOcrEngine({ id, run, license = 'unknown', selfHosted = true }) {
  if (!id || typeof run !== 'function') throw new Error('OCR engine requires id and run()');
  engines.set(id, Object.freeze({ id, run, license, selfHosted }));
}

export function listOcrEngines() {
  return [...engines.values()].map(({ id, license, selfHosted }) => ({ id, license, selfHosted }));
}

export async function runOcrPool(page, engineIds = [...engines.keys()]) {
  const selected = engineIds.map((id) => engines.get(id)).filter(Boolean);
  if (!selected.length) throw new Error('No OCR engines available');
  return Promise.all(selected.map(async (engine) => ({
    engine: engine.id,
    license: engine.license,
    selfHosted: engine.selfHosted,
    result: await engine.run(page),
  })));
}

export function reconcileOcrResults(results, { referenceText = null } = {}) {
  if (!Array.isArray(results) || !results.length) return { status: 'needs-review', text: null };
  const texts = results.map((r) => String(r.result?.text ?? ''));
  if (referenceText != null && texts.every((text) => text === referenceText)) {
    return { status: 'verified-reference', text: referenceText, engines: results.map((r) => r.engine) };
  }
  const counts = new Map(texts.map((text) => [text, texts.filter((x) => x === text).length]));
  const [candidate, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (count >= 2 && count > texts.length / 2) {
    return { status: 'verified-agreement', text: candidate, engines: results.filter((r) => r.result?.text === candidate).map((r) => r.engine) };
  }
  return { status: 'needs-review', text: null, engines: results.map((r) => r.engine) };
}
