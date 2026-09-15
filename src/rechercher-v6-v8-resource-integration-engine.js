import {
  createV6GlobalSourceIntelligenceEngine,
  discoverSource,
  resolveSourceIdentity,
  evaluateRights,
  verifySource,
  isPublishableSource,
} from './rechercher-v6-global-source-intelligence-engine.js';
import {
  createV8AdaptiveLearningEngine,
  buildAdaptivePlan,
} from './rechercher-v8-adaptive-learning-engine.js';

export const V6_V8_INTEGRATION_VERSION = '1.0.0';

export const RESEARCH_RESOURCE_FAMILIES = Object.freeze([
  'OPENITI_KITAB',
  'INTERNET_ARCHIVE',
  'WIKIMEDIA_COMMONS',
  'OPEN_LIBRARY',
  'LIBRARY_OF_CONGRESS',
  'GOOGLE_BOOKS',
  'CROSSREF',
  'NYU_ACO',
  'SMITHSONIAN',
  'PRINCETON_PUL',
  'BRITISH_LIBRARY_EAP',
  'GALLICA_BNF',
  'BODLEIAN',
  'CAMBRIDGE',
  'VATICAN',
  'KAIRouAN',
  'AL_FURQAN',
  'QATAR_DIGITAL_LIBRARY',
  'WAQFEYA',
  'SHAMELA',
  'ALIFTA',
  'ISLAMHOUSE',
  'HADITHENC',
  'TERMINOLOGY_ENCYCLOPEDIA',
  'MINHADJ_RU',
  'ALHADIS_RU',
  'SUNNAPORTAL_RU',
  'ISLAMQA_RU',
  'ISLAMHOUSE_RU',
  'ALQURAN_ISLAM_GOV_QA',
]);

export const RESOURCE_POLICY = Object.freeze({
  catalogFirst: true,
  rightsDefault: 'UNKNOWN',
  unknownPublishable: false,
  restrictedPublishable: false,
  explicitPermissionRequired: true,
  originalPdfImmutable: true,
  canonicalQuranArabicImmutable: true,
  acquisitionIndependent: true,
  proxyRotation: false,
  userAgentRotation: false,
});

export function createV6V8Integration({ learner = {}, observability = null } = {}) {
  return {
    version: V6_V8_INTEGRATION_VERSION,
    v6: createV6GlobalSourceIntelligenceEngine({ observability }),
    v8: createV8AdaptiveLearningEngine({ learner }),
    resources: [],
    traces: [],
    policy: RESOURCE_POLICY,
  };
}

export function registerResearchResource(integration, resource) {
  if (!resource?.resourceId || !resource?.sourceUrl) throw new TypeError('resourceId and sourceUrl are required');
  if (!RESEARCH_RESOURCE_FAMILIES.includes(resource.family)) throw new TypeError(`unsupported resource family: ${resource.family}`);
  const candidate = discoverSource(integration.v6, {
    candidateId: resource.resourceId,
    sourceUrl: resource.sourceUrl,
    sourceType: resource.sourceType || 'DIGITAL_REPOSITORY',
    institution: resource.institution || null,
    language: resource.language || null,
    provenance: resource.provenance || null,
    rightsState: resource.rightsState || 'UNKNOWN',
    contentHash: resource.contentHash || null,
    canonicalQuranArabic: resource.canonicalQuranArabic,
    originalPdf: resource.originalPdf,
  });
  integration.resources.push({ resourceId: resource.resourceId, family: resource.family, candidate });
  integration.traces.push({ type: 'RESOURCE_REGISTERED', resourceId: resource.resourceId, family: resource.family });
  return candidate;
}

export function verifyResearchResource(integration, resourceId, { sourceId, rightsState, rightsEvidence, sourceIdentity = {} } = {}) {
  resolveSourceIdentity(integration.v6, resourceId, { sourceId, ...sourceIdentity });
  evaluateRights(integration.v6, resourceId, rightsState, rightsEvidence);
  const verified = verifySource(integration.v6, resourceId);
  integration.traces.push({ type: 'RESOURCE_VERIFIED', resourceId, sourceId: verified.sourceId, publishable: isPublishableSource(verified) });
  return verified;
}

export function buildLearningPlanFromVerifiedResource(integration, { skillId, graph, result = {}, goal = null } = {}) {
  const sources = [...integration.v6.sources.values()].map(source => ({
    sourceId: source.sourceId,
    rightsStatus: source.rightsState,
    evidenceState: source.state === 'VERIFIED_SOURCE' ? 'SOURCE_VERIFIED' : null,
    provenance: source.provenance,
    relevance: source.relevance || 0,
    authority: source.authority || 0,
  }));
  return buildAdaptivePlan({ graph, state: integration.v8.learner, skillId, result, sources, goal });
}

export function integrationHealth(integration) {
  return {
    version: integration.version,
    v6: {
      candidates: integration.v6.candidates.size,
      verifiedSources: integration.v6.sources.size,
      publishableSources: [...integration.v6.sources.values()].filter(isPublishableSource).length,
    },
    v8: { version: integration.v8.version, learnerId: integration.v8.learner.learnerId },
    resources: integration.resources.length,
    traces: integration.traces.length,
  };
}
