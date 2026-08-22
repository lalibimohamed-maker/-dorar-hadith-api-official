import sourceCatalog from "../config/rijal-sources.json" with { type: "json" };
import plan from "../config/rijal-ingestion-plan.json" with { type: "json" };

function sourcesById() {
  const raw = typeof sourceCatalog.content === "string" ? JSON.parse(sourceCatalog.content) : sourceCatalog;
  return new Map((raw.sources || []).map((source) => [source.id, source]));
}

export function buildRijalIngestionBatch({ sourceId, offset = 0, limit = 100 } = {}) {
  const catalog = sourcesById();
  const ordered = sourceId ? [sourceId] : plan.order.slice(0, 2);
  const sources = ordered.map((id) => catalog.get(id)).filter(Boolean);
  return {
    generatedAt: new Date().toISOString(),
    offset,
    limit,
    sourceIds: sources.map((source) => source.id),
    sources,
    extraction: {
      mode: "source-first",
      preserveOriginalWording: plan.recordPolicy.preserveOriginalWording,
      requiredCriticAttribution: plan.recordPolicy.requireCriticAttribution,
      requiredSourceLocator: plan.recordPolicy.requireSourceLocator,
      preserveDisagreement: plan.recordPolicy.preserveDisagreement,
      neverInferSilenceAsApproval: plan.recordPolicy.neverInferSilenceAsApproval
    },
    requiredFields: plan.requiredFields,
    verificationStates: plan.verificationStates,
    noteAr: "هذه الدفعة تنشئ مهام استخراج وفهرسة؛ لا تنشئ أحكامًا من عندها ولا ترفع أي سجل إلى verified دون تحقق من المصدر والنص والسياق."
  };
}

export function listRijalSources() {
  return [...sourcesById().values()];
}
