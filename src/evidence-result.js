const SIGNAL_LABELS = Object.freeze({
  sourceCoverage: 'عدد المصادر الفريدة في المسار',
  typedSources: 'عدد المصادر المصنفة',
  provenanceCoverage: 'اكتمال توثيق خطوات المسار',
  depth: 'عدد خطوات المسار'
});

export function explainEvidenceQuality(quality = {}) {
  const signals = quality.signals || {};
  return {
    score: Number.isFinite(quality.score) ? quality.score : 0,
    signals: { ...signals },
    explanation: Object.entries(SIGNAL_LABELS)
      .filter(([key]) => Object.prototype.hasOwnProperty.call(signals, key))
      .map(([key, label]) => ({ key, label, value: signals[key] }))
  };
}

export function toEvidenceResult(path = {}) {
  const quality = explainEvidenceQuality(path.quality);
  return {
    nodes: Array.isArray(path.nodes) ? [...path.nodes] : [],
    edges: Array.isArray(path.edges) ? [...path.edges] : [],
    provenance: Array.isArray(path.provenance) ? [...path.provenance] : [],
    quality
  };
}

export function toEvidenceResults(paths = []) {
  return paths.map(toEvidenceResult);
}
