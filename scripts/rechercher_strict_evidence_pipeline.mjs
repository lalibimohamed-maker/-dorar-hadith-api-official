#!/usr/bin/env node
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';

export const EVIDENCE_ROLES = Object.freeze([
  'original',
  'human_translation',
  'commentary',
  'citation',
  'discovery_only',
  'machine_translation'
]);

export function assertTrustedSource({url, allowedOrigins, sourceId}) {
  if (!sourceId || typeof sourceId !== 'string') throw new Error('source_id_required');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('invalid_source_url'); }
  if (parsed.protocol !== 'https:') throw new Error('source_must_use_https');
  if (!allowedOrigins?.has(parsed.origin)) throw new Error('source_origin_not_allowlisted');
  return {sourceId, origin: parsed.origin};
}

export function classifyEvidenceRole(input = {}) {
  if (input.ai_generated === true || input.machine_translation === true) return 'machine_translation';
  if (input.discovery_only === true || input.source_role === 'discovery_cross_reference_only') return 'discovery_only';
  if (input.is_translation === true) return input.human_verified === true ? 'human_translation' : 'discovery_only';
  if (input.is_commentary === true || input.is_fatwa === true) return 'commentary';
  if (input.is_citation === true) return 'citation';
  return 'original';
}

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function inspectOriginalFile(filePath) {
  const bytes = await fs.readFile(filePath);
  return {
    bytes: bytes.byteLength,
    sha256: sha256Bytes(bytes),
    isPdf: bytes.byteLength >= 4 && bytes.subarray(0, 4).toString('ascii') === '%PDF'
  };
}

export function crossReferenceStatus(records = []) {
  const hashes = new Set(records.map(r => r.sha256).filter(Boolean));
  const sources = new Set(records.map(r => r.sourceId || r.provider).filter(Boolean));
  return {
    sourceCount: sources.size,
    hashCount: hashes.size,
    agreement: hashes.size === 1 && sources.size >= 2,
    requiresHumanReview: true,
    interpretation: hashes.size === 1 && sources.size >= 2
      ? 'matching_integrity_evidence_not_religious_correctness_proof'
      : 'source_disagreement_or_insufficient_cross_reference'
  };
}

export function circuitBreakerState({consecutiveFailures = 0, threshold = 3} = {}) {
  return {
    threshold,
    consecutiveFailures,
    tripped: consecutiveFailures >= threshold,
    action: consecutiveFailures >= threshold ? 'freeze_adapter_and_route_to_review' : 'continue_with_audit_log'
  };
}

export function validateEvidenceRecord(record = {}) {
  const errors = [];
  if (!record.sourceId) errors.push('source_id_required');
  if (!record.url) errors.push('source_url_required');
  if (!record.provenance) errors.push('provenance_required');
  if (!record.rightsStatus) errors.push('rights_status_required');
  if (!EVIDENCE_ROLES.includes(record.role)) errors.push('invalid_evidence_role');
  if (record.role === 'machine_translation' && record.promoteToCorpus === true) errors.push('machine_translation_cannot_promote');
  if (record.role === 'discovery_only' && record.promoteToCorpus === true) errors.push('discovery_only_cannot_promote');
  return {valid: errors.length === 0, errors};
}
