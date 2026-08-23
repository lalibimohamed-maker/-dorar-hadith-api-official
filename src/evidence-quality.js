const SOURCE_WEIGHT = Object.freeze({ quran: 1, hadith: 1, tafsir: 1, asbab_al_nuzul: 1, sirah: 1, sharh: 1, rijal: 1, fatwa: 1, fiqh: 1, aqidah: 1, other: 1 });

function finite(value) {
  return Number.isFinite(value) ? value : 0;
}

/**
 * Rank evidence paths using transparent retrieval signals only.
 * This function deliberately does NOT judge authenticity, scholarly authority,
 * or religious correctness. Those properties must remain source-backed claims.
 */
export function scoreEvidencePath(path = {}, sourceRegistry = new Map()) {
  const edges = Array.isArray(path.edges) ? path.edges : [];
  const provenance = Array.isArray(path.provenance) ? path.provenance : [];
  const uniqueSources = new Set(provenance.map(item => item?.sourceId).filter(Boolean));
  const sourceCoverage = uniqueSources.size;
  const provenanceCoverage = edges.length === 0 ? 1 : provenance.length / edges.length;
  const typedSources = [...uniqueSources].reduce((count, id) => {
    const source = sourceRegistry.get(id);
    return count + (source && SOURCE_WEIGHT[source.type] ? 1 : 0);
  }, 0);
  const depthPenalty = edges.length;

  return {
    score: finite(sourceCoverage) + finite(typedSources) + finite(provenanceCoverage) - finite(depthPenalty) * 0.1,
    signals: {
      sourceCoverage,
      typedSources,
      provenanceCoverage,
      depth: edges.length
    }
  };
}

export function rankEvidenceByQuality(paths = [], sourceRegistry = new Map()) {
  return paths
    .map((path, index) => ({ path, index, quality: scoreEvidencePath(path, sourceRegistry) }))
    .sort((a, b) => b.quality.score - a.quality.score || a.path.edges.length - b.path.edges.length || a.index - b.index)
    .map(({ path, quality }) => ({ ...path, quality }));
}
