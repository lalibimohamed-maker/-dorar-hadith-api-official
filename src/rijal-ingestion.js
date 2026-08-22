import fs from 'node:fs';
import path from 'node:path';
import sourceCatalog from "../config/rijal-sources.json" with { type: "json" };
import plan from "../config/rijal-ingestion-plan.json" with { type: "json" };
import digitalRegistry from "../config/rijal-digital-sources.json" with { type: "json" };

function unwrap(value) {
  return typeof value?.content === 'string' ? JSON.parse(value.content) : value;
}

function sourcesById() {
  const raw = unwrap(sourceCatalog);
  return new Map((raw.sources || []).map((source) => [source.id, source]));
}

function digitalSourcesById() {
  const raw = unwrap(digitalRegistry);
  return new Map((raw.sources || []).map((source) => [source.id, source]));
}

const judgmentPatterns = [
  ['thiqah', /\bثقة\b/u], ['thabt', /\bثبت\b/u], ['saduq', /\bصدوق\b/u],
  ['layyin', /\bلين\b/u], ['daif', /\bضعيف\b/u], ['matruk', /\bمتروك\b/u],
  ['kadhdhab', /\bكذاب\b/u], ['majhul', /\bمجهول\b/u],
  ['mukhtalit', /\bمختلط\b/u], ['mudallis', /\bمدلس\b/u]
];

function normalize(value) {
  return value.replace(/[\u064B-\u065F\u0670]/g, '').replace(/\s+/g, ' ').trim();
}

function extractJudgmentEvidence(text, sourceId) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  let current = null;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i].trim();
    if (!raw) continue;
    const line = normalize(raw);
    if (line.length <= 140 && /^(?:[أ-ي][^،:؛]{1,100})(?:،|$)/u.test(line)) {
      current = { nameCandidate: line, startLine: i + 1, evidence: [] };
      entries.push(current);
    }
    if (!current) continue;
    for (const [type, pattern] of judgmentPatterns) {
      if (pattern.test(line)) current.evidence.push({ type, text: raw, sourceId, location: { line: i + 1 }, verification: 'unverified' });
    }
  }
  return entries.filter((entry) => entry.evidence.length > 0);
}

export function buildRijalIngestionBatch({ sourceId, offset = 0, limit = 100 } = {}) {
  const catalog = sourcesById();
  const batch1 = plan.order?.batch1_core_early || [];
  const ordered = sourceId ? [sourceId] : batch1.slice(0, 2);
  const sources = ordered.map((id) => catalog.get(id)).filter(Boolean);
  return {
    generatedAt: new Date().toISOString(), offset, limit,
    sourceIds: sources.map((source) => source.id), sources,
    digitalSources: sources.map((source) => digitalSourcesById().get(source.id)).filter(Boolean),
    extraction: {
      mode: 'source-first',
      preserveOriginalWording: plan.recordPolicy.preserveOriginalWording,
      requiredCriticAttribution: plan.recordPolicy.requireCriticAttribution,
      requiredSourceLocator: plan.recordPolicy.requireSourceLocator,
      preserveDisagreement: plan.recordPolicy.preserveDisagreement,
      neverInferSilenceAsApproval: plan.recordPolicy.neverInferSilenceAsApproval
    },
    requiredFields: plan.requiredFields,
    verificationStates: plan.verificationStates,
    noteAr: 'هذه الدفعة تنشئ مهام استخراج وفهرسة؛ لا تنشئ أحكامًا من عندها ولا ترفع أي سجل إلى verified دون تحقق من المصدر والنص والسياق.'
  };
}

export function ingestText({ sourceId, filePath }) {
  const source = digitalSourcesById().get(sourceId);
  if (!source) throw new Error(`Unknown digital source: ${sourceId}`);
  const absolute = path.resolve(process.cwd(), filePath);
  const text = fs.readFileSync(absolute, 'utf8');
  return {
    source: { id: source.id, title: source.title, author: source.author, role: source.role, catalogUrls: source.catalogUrls },
    input: { filePath: absolute, bytes: Buffer.byteLength(text, 'utf8') },
    entries: extractJudgmentEvidence(text, sourceId),
    policy: { autoVerified: false, silenceIsNotApproval: true, everyJudgmentRequiresLocation: true }
  };
}

export function listRijalSources() { return [...sourcesById().values()]; }
export function listDigitalSources() { return [...digitalSourcesById().values()]; }

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , sourceId, filePath] = process.argv;
  if (!sourceId || !filePath) { console.error('Usage: node src/rijal-ingestion.js <sourceId> <text-file>'); process.exit(1); }
  console.log(JSON.stringify(ingestText({ sourceId, filePath }), null, 2));
}