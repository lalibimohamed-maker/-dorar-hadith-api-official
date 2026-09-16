import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const registryPath = path.join(root, 'config/rechercher-multilingual-source-network-2026.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

export const TRANSLATION_STATES = new Set(registry.translation_states);

export function buildCells(languages = registry.languages, domains = registry.domains) {
  return languages.flatMap((language) => domains.map((domain) => ({
    cell_id: `${language.id}:${domain}`,
    language_id: language.id,
    language_name: language.name,
    domain,
    pipeline: [...registry.pipeline],
    status: 'candidate',
    translation_status: domain === 'translations' ? 'candidate' : null,
    source_language_is_distinct: true,
    provenance_required: true,
    rights_required: true
  })));
}

export function discoverLanguages(records) {
  const existing = new Map(registry.languages.map((language) => [language.id, language]));
  for (const record of records ?? []) {
    const id = String(record?.language_id ?? '').trim().toLowerCase();
    if (!id || existing.has(id)) continue;
    existing.set(id, {
      id,
      name: String(record.language_name ?? id),
      role: 'learning-and-source',
      discovered_from: record.source_id ?? 'language-discovery'
    });
  }
  return [...existing.values()];
}

export function translationDecision({ hasVerifiedTranslation, machineTranslationAvailable }) {
  if (hasVerifiedTranslation) return 'source-verified';
  if (machineTranslationAvailable) return 'machine-translated';
  return 'translation-needed';
}

export function assertCanonicalSeparation(record) {
  if (record.domain !== 'quran' && record.domain !== 'translations') return true;
  if (record.domain === 'quran' && record.translation_text) throw new Error('canonical_arabic_quran cannot contain translation_text');
  if (record.domain === 'translations' && !record.canonical_verse_id) throw new Error('translation must reference canonical_verse_id');
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cells = buildCells();
  const output = {
    schema: 'rechercher/multilingual-source-network/cells/v1',
    generated_from: path.relative(root, registryPath),
    generated_at: new Date().toISOString(),
    language_count: registry.languages.length,
    domain_count: registry.domains.length,
    cell_count: cells.length,
    expansion: registry.expansion,
    cells
  };
  const outPath = path.join(root, 'config/rechercher-multilingual-source-cells.generated.json');
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Rechercher multilingual network: ${output.language_count} languages × ${output.domain_count} domains = ${output.cell_count} cells`);
}
