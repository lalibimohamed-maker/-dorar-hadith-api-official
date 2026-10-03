import { mkdir, writeFile } from 'node:fs/promises';
import CENSUS, { TARGET_LANGUAGES, KNOWLEDGE_DOMAINS } from '../config/rechercher-global-structured-islamic-knowledge-census-v1.js';

const output = process.env.RECHERCHER_CENSUS_OUTPUT || 'artifacts/rechercher/global-structured-islamic-knowledge-census.json';
const sourceById = new Map(CENSUS.sources.map((source) => [source.id, source]));

function buildMatrix() {
  return TARGET_LANGUAGES.flatMap((language) => KNOWLEDGE_DOMAINS.map((domain) => ({
    language: language.code,
    languageName: language.name,
    domain,
    sources: CENSUS.sources.filter((source) => source.languages.includes(language.code) && source.domains.includes(domain)).map((source) => ({
      id: source.id,
      tier: source.tier,
      apiStatus: source.apiStatus,
      sourceUrl: source.sourceUrl,
      docsUrl: source.docsUrl || null,
    })),
  })));
}

function summarize(matrix) {
  return TARGET_LANGUAGES.map((language) => {
    const rows = matrix.filter((row) => row.language === language.code);
    const coveredDomains = rows.filter((row) => row.sources.length > 0).map((row) => row.domain);
    return {
      language: language.code,
      languageName: language.name,
      domainCount: KNOWLEDGE_DOMAINS.length,
      coveredDomainCount: coveredDomains.length,
      uncoveredDomainCount: KNOWLEDGE_DOMAINS.length - coveredDomains.length,
      coveredDomains,
    };
  });
}

const matrix = buildMatrix();
const report = {
  schema: 'rechercher-global-structured-islamic-knowledge-census/v1',
  generatedAt: new Date().toISOString(),
  targetLanguageCount: TARGET_LANGUAGES.length,
  knowledgeDomainCount: KNOWLEDGE_DOMAINS.length,
  sourceCount: sourceById.size,
  sourceTiers: CENSUS.sourceTiers,
  translationPolicy: CENSUS.translationPolicy,
  rule: CENSUS.rule,
  sources: CENSUS.sources,
  languageSummary: summarize(matrix),
  matrix,
};

await mkdir(output.substring(0, output.lastIndexOf('/')), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ output, targetLanguageCount: report.targetLanguageCount, knowledgeDomainCount: report.knowledgeDomainCount, sourceCount: report.sourceCount }, null, 2));
