import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CONFIGS = {
  completeness: 'config/encyclopedia-completeness-registry-2026.json',
  interoperability: 'config/interoperability-preservation-registry-2026.json',
  accessibility: 'config/accessibility-i18n-registry-2026.json',
  resilience: 'config/resilience-operations-registry-2026.json',
  risk: 'config/evaluation-risk-governance-registry-2026.json',
  engines: 'config/scholarly-engine-mesh-2026.json'
};

function readJson(relativePath) {
  const absolute = path.join(ROOT, relativePath);
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateCompletenessArchitecture() {
  const cfg = Object.fromEntries(
    Object.entries(CONFIGS).map(([key, file]) => [key, readJson(file)])
  );

  assert(
    cfg.completeness.architectureRule.includes('authoritative content'),
    'Authoritative-content isolation rule is missing.'
  );
  assert(
    cfg.risk.claimModel.claimLevelCitationRequired === true,
    'Claim-level citations are mandatory.'
  );
  assert(
    cfg.risk.claimModel.inferenceMustBeExplicitlyLabeled === true,
    'Inference labeling is mandatory.'
  );
  assert(
    cfg.risk.claimModel.modelGeneratedTextNeverCountsAsPrimaryEvidence === true,
    'Model output must never become primary evidence.'
  );
  assert(
    cfg.resilience.backup.noSilentOverwrite === true,
    'Silent overwrite protection is required.'
  );
  assert(
    cfg.accessibility.accessibility.target === 'WCAG-2.2-AA',
    'Accessibility target must be WCAG 2.2 AA.'
  );
  assert(
    cfg.interoperability.standards.iiifPresentation.version === '3.0',
    'IIIF Presentation 3.0 is required.'
  );
  assert(
    cfg.interoperability.standards.roCrate.version === '1.2',
    'RO-Crate 1.2 is required.'
  );
  assert(
    cfg.interoperability.preservation.restoreVerificationRequired === true,
    'Restore verification is required.'
  );

  const engines = cfg.engines.engines ?? {};
  for (const [capability, entries] of Object.entries(engines)) {
    if (!Array.isArray(entries)) continue;
    assert(
      entries.length >= cfg.engines.minimumRedundancy.perCapability,
      `Capability ${capability} has fewer than the required redundant engines.`
    );
  }

  return {
    ok: true,
    checked: Object.keys(CONFIGS),
    rules: {
      authoritativeCorpusIsolation: true,
      claimLevelCitations: true,
      explicitInference: true,
      modelNotPrimaryEvidence: true,
      wcag22AA: true,
      iiif30: true,
      roCrate12: true,
      restoreVerification: true,
      redundantEngines: true
    }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(validateCompletenessArchitecture(), null, 2));
}
