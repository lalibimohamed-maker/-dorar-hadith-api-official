import fs from 'node:fs';
import path from 'node:path';

const CONFIG_PATH = path.resolve('config/rechercher-global-learning-strategy-2026.json');

export function loadGlobalLearningStrategy() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

const hasAll = (actual, required) => required.every(value => Array.isArray(actual) && actual.includes(value));

export function validateGlobalLearningStrategy(strategy = loadGlobalLearningStrategy()) {
  const errors = [];
  if (strategy.status !== 'frozen-strategic-requirements') errors.push('strategy must be frozen');
  if (strategy.version !== '1.0.0') errors.push('unsupported strategy version');

  const requiredPillars = ['global-search','ya-bawabat-al-ilm','self-test','teach-me','read-and-learn','recitation','tajweed-learning','knowledge-graph','flashcards-review','world-language-learning','mastery-dashboard','research-mode'];
  if (!hasAll(strategy.productPillars, requiredPillars)) errors.push('product pillars incomplete');

  const requiredMethods = ['retrieval-practice','spaced-practice','interleaving','elaboration','worked-examples','self-explanation','corrective-feedback','transfer-practice'];
  if (!hasAll(strategy.learningMethods, requiredMethods)) errors.push('learning methods incomplete');

  const requiredMastery = ['recognition','recall','explanation','application','discrimination','transfer','source-navigation','confidence-calibration','retention'];
  if (!hasAll(strategy.masteryDimensions, requiredMastery)) errors.push('mastery dimensions incomplete');

  if (strategy.adaptiveRecommendationContract?.explainable !== true) errors.push('adaptive recommendations must be explainable');
  if (!hasAll(strategy.adaptiveRecommendationContract?.requiredFields, ['why-this-activity','why-now','supporting-source'])) {
    errors.push('adaptive recommendation explanation contract incomplete');
  }

  if (strategy.languages?.canonicalQuranArabicUnchanged !== true) errors.push('canonical Quran Arabic must remain unchanged');
  if (strategy.languages?.translationDoesNotReplaceSource !== true) errors.push('translation must not replace source');
  if (strategy.recitation?.authoritativeCorrectionRequiresValidatedEvaluator !== true) {
    errors.push('recitation authority boundary missing');
  }

  const governance = strategy.governance ?? {};
  for (const [key, message] of [
    ['acquisitionIndependent','learning must remain acquisition-independent'],
    ['acquisitionMustNotWaitForLearning','acquisition must not wait for learning'],
    ['noLearningFeatureMayBlockPdfAcquisition','learning must not block PDF acquisition'],
    ['rightsAware','rights awareness must remain enabled'],
    ['provenancePreserving','provenance must remain preserved'],
    ['securityControlsPreserved','security controls must remain preserved'],
    ['protectedMainPreserved','protected main must remain preserved']
  ]) {
    if (governance[key] !== true) errors.push(message);
  }

  const epistemic = strategy.epistemicBoundary ?? {};
  if (epistemic.aiDoesNotBecomeReligiousAuthority !== true) errors.push('AI authority boundary missing');

  return { ok: errors.length === 0, errors };
}

export function featureEvidenceRecord({
  feature,
  pedagogicalMechanism,
  evidence = [],
  implementation = [],
  evaluationMetric = [],
  limitations = []
} = {}) {
  if (!feature || !pedagogicalMechanism) throw new Error('feature and pedagogicalMechanism are required');
  return {
    schemaVersion: '1.0.0',
    feature,
    pedagogicalMechanism,
    evidence: [...evidence],
    implementation: [...implementation],
    evaluationMetric: [...evaluationMetric],
    limitations: [...limitations]
  };
}

export function explainAdaptiveRecommendation({
  reasons = [],
  source = null,
  nextReview = null
} = {}) {
  return {
    reasons: [...new Set(reasons.filter(Boolean))],
    whyThisActivity: reasons.length > 0,
    whyNow: Boolean(nextReview || reasons.length > 0),
    supportingSource: source,
    inspectable: true
  };
}

export const PRODUCT_SURFACE_IDS = Object.freeze(loadGlobalLearningStrategy().productPillars);
