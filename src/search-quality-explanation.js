import { rankEvidenceByQuality } from './evidence-quality.js';

export function buildEvidenceQualitySummary(paths = [], sourceRegistry = new Map()) {
  return rankEvidenceByQuality(paths, sourceRegistry).map((path, index) => ({
    rank: index + 1,
    nodes: path.nodes || [],
    edges: path.edges || [],
    provenance: path.provenance || [],
    quality: path.quality,
    explanation: {
      source_coverage: path.quality?.signals?.sourceCoverage || 0,
      provenance_coverage: path.quality?.signals?.provenanceCoverage || 0,
      typed_sources: path.quality?.signals?.typedSources || 0,
      depth: path.quality?.signals?.depth || 0
    }
  }));
}

export function explainSearchResult(result = {}, options = {}) {
  const quality = result.quality || null;
  return {
    id: result.id || null,
    title: result.title || null,
    quality,
    explanation: quality ? {
      source_coverage: quality.signals.sourceCoverage,
      provenance_coverage: quality.signals.provenanceCoverage,
      typed_sources: quality.signals.typedSources,
      depth: quality.signals.depth
    } : null,
    note: options.note || 'These signals describe retrieval and provenance coverage only; they do not determine authenticity, scholarly authority, or religious correctness.'
  };
}
