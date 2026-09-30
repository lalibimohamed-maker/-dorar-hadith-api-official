import { loadCorpus } from "./corpus_repository.js";
import { indexCorpusToGraphRag } from "./rechercher-omega-graphrag-runtime.js";

const VERIFIED_STATES=new Set(["verified","source_verified","source-verified","edition_verified","edition-verified","institution_verified","institution-verified","scholar_reviewed","scholar-reviewed"]);

function isVerified(record){
  return VERIFIED_STATES.has(String(record?.verification_state??record?.verificationState??record?.reviewStatus??""))
    || record?.status==="verified" || record?.trusted===true;
}

export function createCorpusGraphRagPipeline({ embedder, graphWriter, vectorWriter, batchSize = 32, strict = true, corpusLoader = loadCorpus, verifiedOnly = true } = {}) {
  if (typeof corpusLoader !== "function") throw new TypeError("corpusLoader must be a function");
  return Object.freeze({
    async indexAll() {
      const loaded = corpusLoader();
      if (!Array.isArray(loaded)) throw new TypeError("corpusLoader must return an array");
      const records = verifiedOnly ? loaded.filter(isVerified) : loaded;
      if (verifiedOnly && records.length===0 && loaded.length>0) throw new Error("NO_VERIFIED_CORPUS_RECORDS");
      const result = await indexCorpusToGraphRag(records, { embedder, graphWriter, vectorWriter, batchSize, strict });
      return Object.freeze({
        ...result,
        corpusRecordsLoaded: loaded.length,
        verifiedCorpusRecordsIndexed: records.length,
        unverifiedCorpusRecordsExcluded: loaded.length-records.length,
        fullCorpusCoverageVerified: verifiedOnly ? result.indexedRecords===records.length : result.indexedRecords===loaded.length,
        source: "loadCorpus",
        verifiedOnly
      });
    }
  });
}
