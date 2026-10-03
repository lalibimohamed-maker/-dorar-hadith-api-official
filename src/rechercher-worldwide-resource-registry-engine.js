const REQUIRED_RESOURCE_FIELDS = Object.freeze(['resourceId', 'resourceType', 'title', 'sourceUrl', 'language', 'rights', 'provenance', 'retrievalDate']);
const RIGHTS = Object.freeze(['ALLOWED', 'RESTRICTED', 'UNKNOWN', 'EXPLICIT_PERMISSION_REQUIRED']);

export const WORLDWIDE_RESOURCE_REGISTRY_VERSION = '1.0.0';

export const EXTERNAL_STANDARDS = Object.freeze({
  IIIF_PRESENTATION: '3.0',
  W3C_WEB_ANNOTATION: 'Recommendation',
  W3C_PROV_O: 'Recommendation',
  PREMIS: '3.0',
  RO_CRATE: '1.2',
  DATACITE: '4.7',
  JSON_LD: '1.1',
});

export const SOURCE_FAMILIES = Object.freeze([
  'NATIONAL_LIBRARY', 'UNIVERSITY_LIBRARY', 'ARCHIVE', 'MUSEUM',
  'MANUSCRIPT_REPOSITORY', 'DIGITAL_HUMANITIES', 'ISLAMIC_CORPUS',
  'SCHOLARLY_GRAPH', 'OPEN_REPOSITORY', 'BOOK_PDF', 'ARTICLE',
  'AUDIO', 'VIDEO', 'IMAGE', 'OCR_HTR', 'IIIF', 'STRUCTURED_DATA', 'API', 'WEB_SOURCE'
]);

export const MULTILINGUAL_RELATIONS = Object.freeze([
  'EXACT', 'CLOSE', 'HISTORICAL', 'SCHOOL_SPECIFIC', 'TRANSLATION_VARIANT', 'NO_EXACT_EQUIVALENT'
]);

const clone = value => structuredClone(value);

function requireField(value, name) {
  if (value === undefined || value === null || value === '') throw new TypeError(`${name} is required`);
}

function assertRights(rights) {
  if (!RIGHTS.includes(rights)) throw new TypeError(`invalid rights state: ${rights}`);
}

export function createWorldwideResourceRegistry() {
  return {
    version: WORLDWIDE_RESOURCE_REGISTRY_VERSION,
    resources: new Map(),
    engines: new Map(),
    standards: new Map(Object.entries(EXTERNAL_STANDARDS)),
    sourceFamilies: new Set(SOURCE_FAMILIES),
    auditLog: [],
  };
}

export function registerWorldwideResource(registry, input = {}) {
  for (const field of REQUIRED_RESOURCE_FIELDS) requireField(input[field], field);
  assertRights(input.rights);
  const record = Object.freeze({
    resourceId: input.resourceId,
    resourceType: input.resourceType,
    title: input.title,
    sourceUrl: input.sourceUrl,
    language: input.language,
    rights: input.rights,
    provenance: clone(input.provenance),
    retrievalDate: input.retrievalDate,
    license: input.license || null,
    contentHash: input.contentHash || null,
    persistentId: input.persistentId || null,
    workId: input.workId || null,
    editionId: input.editionId || null,
    manifestationId: input.manifestationId || null,
    pageId: input.pageId || null,
    passageId: input.passageId || null,
    iiifManifestId: input.iiifManifestId || null,
    reviewState: input.reviewState || 'UNREVIEWED',
    publishable: input.rights === 'ALLOWED' && input.publishable === true,
  });
  registry.resources.set(record.resourceId, record);
  registry.auditLog.push({ event: 'RESOURCE_REGISTERED', resourceId: record.resourceId, at: new Date().toISOString() });
  return clone(record);
}

export function registerEngineResource(registry, input = {}) {
  for (const field of ['engineId', 'stageId', 'version', 'status']) requireField(input[field], field);
  const record = Object.freeze({
    engineId: input.engineId,
    stageId: input.stageId,
    version: input.version,
    status: input.status,
    sourceResourceIds: [...new Set(input.sourceResourceIds || [])],
    testPath: input.testPath || null,
    configPath: input.configPath || null,
    contractPath: input.contractPath || null,
    handoffs: [...new Set(input.handoffs || [])],
  });
  registry.engines.set(record.engineId, record);
  registry.auditLog.push({ event: 'ENGINE_REGISTERED', engineId: record.engineId, at: new Date().toISOString() });
  return clone(record);
}

export function validateWorldwideResource(resource) {
  const missing = REQUIRED_RESOURCE_FIELDS.filter(field => resource?.[field] === undefined || resource?.[field] === null || resource?.[field] === '');
  const rightsValid = RIGHTS.includes(resource?.rights);
  const publishableValid = resource?.publishable !== true || resource?.rights === 'ALLOWED';
  const rightsGate = resource?.rights === 'ALLOWED';
  return { valid: missing.length === 0 && rightsValid && rightsGate && publishableValid, missing, rightsValid, publishableValid, rightsGate };
}

export function validateEngineRegistration(registry, engineId) {
  const engine = registry.engines.get(engineId);
  if (!engine) return { valid: false, reason: 'ENGINE_NOT_REGISTERED' };
  const missingResourceIds = engine.sourceResourceIds.filter(id => !registry.resources.has(id));
  return { valid: missingResourceIds.length === 0, engineId, missingResourceIds };
}

export function validateExternalStandardCoverage(registry) {
  const required = Object.keys(EXTERNAL_STANDARDS);
  const present = required.filter(key => registry.standards.has(key));
  return { valid: present.length === required.length, required, present, missing: required.filter(key => !registry.standards.has(key)) };
}

export function buildWorldwideResourceAudit(registry) {
  const resourceResults = [...registry.resources.values()].map(resource => ({ resourceId: resource.resourceId, ...validateWorldwideResource(resource) }));
  const engineResults = [...registry.engines.keys()].map(engineId => validateEngineRegistration(registry, engineId));
  const standardCoverage = validateExternalStandardCoverage(registry);
  const invalidRights = resourceResults.filter(r => !r.valid).map(r => r.resourceId);
  return {
    version: WORLDWIDE_RESOURCE_REGISTRY_VERSION,
    resourceCount: resourceResults.length,
    engineCount: engineResults.length,
    standardCoverage,
    resourcesValid: invalidRights.length === 0,
    enginesValid: engineResults.every(r => r.valid),
    rightsSafe: resourceResults.every(r => r.publishableValid && r.rightsGate),
    complete: resourceResults.length > 0 && engineResults.length > 0 && standardCoverage.valid && invalidRights.length === 0 && engineResults.every(r => r.valid),
    resourceResults,
    engineResults,
    sourceFamilies: [...registry.sourceFamilies],
    auditLogSize: registry.auditLog.length,
  };
}

export function assertWorldwideResourceAudit(audit) {
  if (!audit?.complete) throw new Error(`Worldwide Rechercher resource audit blocked: ${JSON.stringify(audit)}`);
  return true;
}
