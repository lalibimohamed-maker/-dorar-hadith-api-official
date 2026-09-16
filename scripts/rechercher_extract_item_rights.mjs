import crypto from 'node:crypto';

export const RIGHTS_FIELDS = [
  'license', 'license_url', 'rights', 'copyright', 'public_domain', 'cc0', 'cc_by', 'cc_by_sa',
  'permission_statements', 'institutional_terms', 'item_level_metadata'
];

const KEY_ALIASES = new Map([
  ['license', 'license'], ['licence', 'license'], ['license_name', 'license'], ['licence_name', 'license'],
  ['license_url', 'license_url'], ['licence_url', 'license_url'], ['rights', 'rights'],
  ['copyright', 'copyright'], ['copyright_notice', 'copyright'], ['public_domain', 'public_domain'],
  ['publicdomain', 'public_domain'], ['cc0', 'cc0'], ['cc_by', 'cc_by'], ['cc-by', 'cc_by'],
  ['cc_by_sa', 'cc_by_sa'], ['cc-by-sa', 'cc_by_sa'], ['permission', 'permission_statements'],
  ['permissions', 'permission_statements'], ['permission_statement', 'permission_statements'], ['permission_statements', 'permission_statements'],
  ['terms', 'institutional_terms'], ['terms_of_use', 'institutional_terms'], ['institutional_terms', 'institutional_terms'],
  ['item_metadata', 'item_level_metadata'], ['item_level_metadata', 'item_level_metadata'],
  ['item_id', 'item_level_metadata'], ['resource_id', 'item_level_metadata'], ['identifier', 'item_level_metadata']
]);

const ITEM_KEYS = new Set(['item_id', 'resource_id', 'identifier', 'ark', 'handle', 'isbn', 'doi']);
const REDISTRIBUTABLE_LICENSE = /(?:\bcc0\b|public\s*domain|creativecommons\.org\/licenses\/by(?:\/|$)|creativecommons\.org\/licenses\/by-sa(?:\/|$)|\bcc\s*by(?:-sa)?\b)/i;
const LICENSE_URL = /https?:\/\/creativecommons\.org\/licenses\/(?:by|by-sa|zero)(?:\/[^\s"'<>]*)?|https?:\/\/[^\s"'<>]+/i;

function scalar(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return JSON.stringify(value);
}

function walk(value, path = [], out = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, [...path, String(index)], out));
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    const mapped = KEY_ALIASES.get(normalized);
    const valueText = scalar(child);
    if (mapped && valueText) out.push({field: mapped, source_key: key, value: valueText, path: [...path, key].join('.')});
    if (ITEM_KEYS.has(normalized) && valueText) out.push({field: 'item_level_metadata', source_key: key, value: valueText, path: [...path, key].join('.')});
    if (child && typeof child === 'object') walk(child, [...path, key], out);
  }
  return out;
}

export function extractRightsMetadata({metadata = null, text = '', sourceUrl = null, itemId = null, resourceId = null, checkedAt = new Date().toISOString()} = {}) {
  const fields = walk(metadata || {});
  const textValue = String(text || '');
  const patterns = [
    ['license_url', /https?:\/\/creativecommons\.org\/licenses\/[A-Za-z0-9._~:/?#\[\]@!$&()*+,;=%-]+/gi],
    ['public_domain', /public\s+domain/gi],
    ['cc0', /\bCC0\b/gi],
    ['cc_by_sa', /\bCC[- ]BY[- ]SA\b/gi],
    ['cc_by', /\bCC[- ]BY\b/gi],
    ['permission_statements', /(?:permission|permissions)\s+(?:to|for)\s+[^.\n]{0,300}/gi],
    ['institutional_terms', /(?:terms of use|terms of service|institutional terms)[^.\n]{0,300}/gi],
    ['rights', /(?:rights reserved|all rights reserved|rights statement)[^.\n]{0,300}/gi],
    ['copyright', /(?:copyright|©)[^.\n]{0,300}/gi]
  ];
  for (const [field, pattern] of patterns) {
    for (const match of textValue.matchAll(pattern)) fields.push({field, source_key: 'text', value: match[0].trim(), path: 'text'});
  }
  if (sourceUrl) fields.push({field: 'item_level_metadata', source_key: 'source_url', value: sourceUrl, path: 'source_url'});
  // Caller-supplied IDs are candidate identities for the record, not proof that
  // rights evidence belongs to that item. Only identifiers found in the item's
  // own metadata can establish item-level rights matching.
  if (itemId) fields.push({field: 'item_level_metadata', source_key: 'caller_item_id', value: itemId, path: 'caller_item_id'});
  if (resourceId) fields.push({field: 'item_level_metadata', source_key: 'caller_resource_id', value: resourceId, path: 'caller_resource_id'});

  const unique = [...new Map(fields.map((f) => [`${f.field}|${f.value}|${f.path}`, f])).values()];
  const identityFields = unique.filter((f) => f.field === 'item_level_metadata' && /^(item_id|resource_id|identifier)$/i.test(f.source_key));
  const rightsTerms = unique.filter((f) => f.field !== 'item_level_metadata');
  const normalizedText = rightsTerms.map((f) => f.value).join(' ');
  const identity = itemId || resourceId || identityFields[0]?.value || null;

  // Caller-supplied IDs establish a candidate identity only. Redistribution
  // still requires an identifier present in the item's own metadata.
  const metadataHasIdentity = identityFields.length > 0;
  const itemSpecificRights = metadataHasIdentity && rightsTerms.length > 0;
  const licenseUrl = unique.find((f) => f.field === 'license_url')?.value || (normalizedText.match(LICENSE_URL)?.[0] || null);
  const redistributableTerms = REDISTRIBUTABLE_LICENSE.test(normalizedText) || unique.some((f) => ['cc0', 'cc_by', 'cc_by_sa', 'public_domain'].includes(f.field));
  const redistributionEvidence = itemSpecificRights && redistributableTerms;

  return {
    schema: 'rechercher/item-rights-evidence/v2',
    item_id: itemId || null,
    resource_id: resourceId || null,
    source_url: sourceUrl || null,
    checked_at: checkedAt,
    fields: unique,
    normalized: {
      license: unique.find((f) => f.field === 'license')?.value || null,
      license_url: licenseUrl,
      rights: unique.filter((f) => f.field === 'rights').map((f) => f.value),
      copyright: unique.filter((f) => f.field === 'copyright').map((f) => f.value),
      public_domain: unique.some((f) => f.field === 'public_domain'),
      cc0: unique.some((f) => f.field === 'cc0'),
      cc_by: unique.some((f) => f.field === 'cc_by'),
      cc_by_sa: unique.some((f) => f.field === 'cc_by_sa'),
      permission_statements: unique.filter((f) => f.field === 'permission_statements').map((f) => f.value),
      institutional_terms: unique.filter((f) => f.field === 'institutional_terms').map((f) => f.value),
      item_level_metadata: unique.filter((f) => f.field === 'item_level_metadata').map((f) => ({source_key: f.source_key, value: f.value, path: f.path}))
    },
    item_identity: identity,
    item_level_match: itemSpecificRights,
    redistribution_evidence: redistributionEvidence,
    evidence_fingerprint: crypto.createHash('sha256').update(JSON.stringify(unique)).digest('hex')
  };
}

export function decideItemRedistribution(evidence) {
  if (!evidence?.item_level_match || !evidence?.redistribution_evidence) {
    return {rights_status: 'review-required', rights_decision: 'fail-closed', redistribution_permission: 'not-granted', item_level_rights_verified: false};
  }
  return {rights_status: 'known-terms', rights_decision: 'verified-per-item', redistribution_permission: 'verified-per-item', item_level_rights_verified: true};
}
