import { loadCorpus } from "./corpus_repository.js";
import { indexCorpusToGraphRag } from "./rechercher-omega-graphrag-runtime.js";

export function createCorpusGraphRagPipeline({ embedder, graphWriter, vectorWriter, batchSize = 32, strict = true, corpusLoader = loadCorpus } = {}) {
  if (typeof corpusLoader !== "function") throw new TypeError("corpusLoader must be a function");
  return Object.freeze({
    async indexAll() {
      const records = corpusLoader();
      if (!Array.isArray(records)) throw new TypeError("corpusLoader must return an array");
      const result = await indexCorpusToGraphRag(records, { embedder, graphWriter, vectorWriter, batchSize, strict });
      return Object.freeze({
        ...result,
        corpusRecordsLoaded: records.length,
        fullCorpusCoverageVerified: result.indexedRecords === records.length,
        source: "loadCorpus"
      });
    }
  });
}
