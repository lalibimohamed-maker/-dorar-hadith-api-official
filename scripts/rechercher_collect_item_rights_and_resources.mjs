import fs from 'node:fs/promises';
import path from 'node:path';

const dir = process.argv[2] || 'artifacts/rechercher/global-multilingual-research';
const files = (await fs.readdir(dir)).filter((name) => name.endsWith('.jsonl')).sort();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cache = new Map();
const RIGHTS_KEYS = ['license', 'license_url', 'licenseurl', 'rights', 'copyright', 'public_domain', 'publicdomain', 'permission', 'permissions', 'usage_rights', 'rightsstatement'];
const REDISTRIBUTABLE_LICENSE = /(?:creativecommons\.org\/(?:licenses\/(?:by|by-sa)(?:\/|$)|publicdomain\/zero)|\bcc0(?:[- ]?1\.0)?\b|\bpublic[ _-]?domain\b|\bpublic[ _-]?domain[ _-]?mark\b|\bCC[ -]?BY(?:[ -]?SA)?(?:[ -]?\d(?:\.\d)?)?\b)/i;
const EXPLICIT_PERMISSION = /(?:permission|license|rights).{0,180}(?:redistribut|reproduce|copy|share|download|reuse|publicly available|open access)/is;

async function get(url, retries = 3) {
  if (!url) return null;
  if (cache.has(url)) return cache.get(url);
  let lastError = null;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const res = await fetch(url, {redirect: 'follow', headers: {accept: 'application/json,text/html;q=0.9,*/*;q=0.1', 'user-agent': 'DinAllah-Rechercher/rights-audit-v2'}});
      const text = await res.text();
      const record = {url, final_url: res.url, http_status: res.status, ok: res.ok, content_type: res.headers.get('content-type') || null, text};
      cache.set(url, record);
      if (res.status === 429 || res.status >= 500) await sleep(1000 * (attempt + 1));
      return record;
    } catch (error) {
      lastError = error;
      await sleep(700 * (attempt + 1));
    }
  }
  const record = {url, final_url: url, http_status: null, ok: false, error: String(lastError?.message || lastError)};
  cache.set(url, record);
  return record;
}

function parseJson(text) { try { return JSON.parse(text); } catch { return null; } }
function flattenRights(value, prefix = '', out = []) {
  if (value === null || value === undefined) return out;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    if (RIGHTS_KEYS.some((key) => prefix.toLowerCase().includes(key))) out.push({field: prefix, value: String(value)});
    return out;
  }
  if (Array.isArray(value)) { value.forEach((item, index) => flattenRights(item, `${prefix}[${index}]`, out)); return out; }
  for (const [key, child] of Object.entries(value)) flattenRights(child, prefix ? `${prefix}.${key}` : key, out);
  return out;
}
function extractHtmlRights(html) {
  const fields = [];
  const patterns = [
    /<meta[^>]+(?:name|property)=["'](?:dc\.rights|dcterms\.rights|rights|license|dc\.license|og:license)["'][^>]+content=["']([^"']+)["']/gi,
    /<link[^>]+rel=["'][^"']*license[^"']*["'][^>]+href=["']([^"']+)["']/gi,
    /(?:license|rights|copyright|public domain|permission)[^<\n]{0,400}/gi
  ];
  for (const pattern of patterns) for (const match of html.matchAll(pattern)) fields.push({field: 'html-rights', value: match[1] || match[0]});
  return fields;
}
function findArchiveItem(json) {
  const doc = json?.response?.docs?.[0];
  if (!doc) return null;
  return {item_id: doc.identifier || null, title: doc.title || null, creator: doc.creator || null, date: doc.date || null, mediatype: doc.mediatype || null};
}
function extractArchivePdfResources(metadata) {
  const files = Array.isArray(metadata?.files) ? metadata.files : [];
  return files.filter((file) => String(file.name || '').toLowerCase().endsWith('.pdf')).map((file) => ({name: file.name, size: file.size || null, source_url: metadata?.d1_url && file.name ? `${metadata.d1_url}/${encodeURIComponent(file.name)}` : null, format: file.format || null}));
}

for (const file of files) {
  const filePath = path.join(dir, file);
  const rows = (await fs.readFile(filePath, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
  for (const row of rows) {
    const corpus = row.stages.find((stage) => stage.stage === 'digital_corpus');
    const rights = row.stages.find((stage) => stage.stage === 'rights');
    const source = row.stages.find((stage) => stage.stage === 'primary_or_institutional_source');
    rights.item_level_rights_verified = false;
    rights.rights_decision = 'fail-closed';
    rights.redistribution_permission = 'not-granted';

    let item = null;
    const corpusResponse = await get(corpus?.evidence?.final_url || corpus?.evidence?.url);
    item = findArchiveItem(parseJson(corpusResponse?.text || ''));
    const rightsFields = [];
    const resourceCandidates = [];
    let itemMetadataIdentity = null;
    if (item?.item_id) {
      row.item_id = item.item_id;
      row.resource_id = item.item_id;
      const metadataResponse = await get(`https://archive.org/metadata/${encodeURIComponent(item.item_id)}`);
      const metadata = parseJson(metadataResponse?.text || '');
      if (metadata) {
        const itemMetadata = metadata.metadata || {};
        itemMetadataIdentity = itemMetadata.identifier || null;
        rightsFields.push(...flattenRights(itemMetadata));
        rightsFields.push(...flattenRights(metadata));
        resourceCandidates.push(...extractArchivePdfResources(metadata));
        row.resource_metadata = {source: 'archive.org/metadata', item_id: item.item_id, title: itemMetadata.title || item.title || null, creator: itemMetadata.creator || item.creator || null, mediatype: itemMetadata.mediatype || item.mediatype || null, pdf_candidates: resourceCandidates};
      }
    }
    if (source?.evidence?.url) {
      const sourceResponse = await get(source.evidence.final_url || source.evidence.url);
      if (sourceResponse?.ok) {
        const sourceJson = parseJson(sourceResponse.text || '');
        if (sourceJson) rightsFields.push(...flattenRights(sourceJson));
        else rightsFields.push(...extractHtmlRights(sourceResponse.text || ''));
      }
    }
    const deduped = rightsFields.filter((x, i, a) => x.value && a.findIndex((y) => y.field === x.field && y.value === x.value) === i);
    const rightsText = deduped.map((x) => `${x.field}: ${x.value}`).join('\n');
    const explicitLicense = REDISTRIBUTABLE_LICENSE.test(rightsText);
    const explicitPermission = EXPLICIT_PERMISSION.test(rightsText);
    // The item id from discovery is only an identity candidate. Rights become
    // item-level evidence only when the rights metadata itself contains the
    // item's identifier. Generic source/legal pages must never qualify.
    const itemMetadataRights = itemMetadataIdentity && deduped.some((x) => /identifier|item_id|resource_id/i.test(x.field) && String(x.value) === String(itemMetadataIdentity));
    const itemEvidence = Boolean(itemMetadataRights && deduped.some((x) => RIGHTS_KEYS.some((key) => x.field.toLowerCase().includes(key))));
    const redistributionEvidence = itemEvidence && (explicitLicense || explicitPermission);
    row.rights_evidence = {item_id: row.item_id || null, source_url: source?.evidence?.final_url || source?.evidence?.url || null, fields: deduped, explicit_license_or_public_domain: explicitLicense, explicit_permission_statement: explicitPermission, item_level_evidence: itemEvidence, redistribution_evidence: redistributionEvidence, checked_at: new Date().toISOString()};
    rights.evidence = {...(rights.evidence || {}), item_id: row.item_id || null, fields: deduped, pdf_candidates: resourceCandidates, item_metadata_identity: itemMetadataIdentity, item_level_evidence: itemEvidence, checked_at: row.rights_evidence.checked_at};
    if (redistributionEvidence) {
      rights.rights_status = 'known-terms';
      rights.item_level_rights_verified = true;
      rights.rights_decision = 'eligible-for-public-redistribution';
      rights.redistribution_permission = 'verified-per-item';
      row.redistribution_permission = 'verified-per-item';
    } else {
      rights.rights_status = row.item_id ? 'review-required' : 'item-not-identified';
      row.redistribution_permission = 'not-granted';
    }
  }
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
}
console.log(JSON.stringify({schema: 'rechercher/item-rights-resource-collection/v2', files: files.length, policy: 'open-discovery-and-resource-analysis; fail-closed-only-at-public-redistribution-gate; generic-source-rights-never-qualify'}));
