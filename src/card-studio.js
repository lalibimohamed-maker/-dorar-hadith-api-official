const ALLOWED_EXPORTS = new Set(['html', 'svg', 'png', 'webp', 'pdf', 'print-a4', 'social-vertical', 'mobile-story']);
const ALLOWED_LICENSE_STATES = new Set(['public-domain', 'cc0', 'cc-by', 'cc-by-sa', 'explicit-permission', 'owned-original']);

export function validateCardManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new TypeError('card manifest must be an object');
  const errors = [];
  if (!manifest.cardId) errors.push('cardId is required');
  if (!manifest.sourceId) errors.push('sourceId is required');
  if (!manifest.canonicalText) errors.push('canonicalText is required');
  if (!manifest.locale) errors.push('locale is required');
  if (!ALLOWED_EXPORTS.has(manifest.format)) errors.push(`unsupported format: ${manifest.format}`);
  if (manifest.assetLicenseState && !ALLOWED_LICENSE_STATES.has(manifest.assetLicenseState)) {
    errors.push(`assetLicenseState is not publishable: ${manifest.assetLicenseState}`);
  }
  if (manifest.machineTranslated && manifest.religiousMeaningReviewed !== true) {
    errors.push('machine-translated religious content requires reviewed meaning before publication');
  }
  return { ok: errors.length === 0, errors };
}

export function buildCardFooter({ sourceShortForm = '', license = '', generatedAt, cardId }) {
  return {
    brand: 'موسوعة دين الله',
    sourceShortForm,
    license,
    generatedAt: generatedAt ?? new Date().toISOString(),
    cardId
  };
}

export function buildRegenerationKey(manifest) {
  const stable = JSON.stringify({
    cardId: manifest.cardId,
    sourceId: manifest.sourceId,
    canonicalText: manifest.canonicalText,
    locale: manifest.locale,
    format: manifest.format,
    templateVersion: manifest.templateVersion ?? '1'
  });
  let hash = 2166136261;
  for (let i = 0; i < stable.length; i += 1) {
    hash ^= stable.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
