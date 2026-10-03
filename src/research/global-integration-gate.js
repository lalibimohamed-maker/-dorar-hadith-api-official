import fs from 'node:fs';

const readJson = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));

export function auditGlobalResearchSystem() {
  const army = readJson('../../config/research-engine-army-2026.json');
  const gaps = readJson('../../config/research/research-gap-engines-2026.json');
  const trust = readJson('../../config/research/external-content-trust-2026.json');
  const lineage = readJson('../../config/research/source-lineage-and-context-2026.json');
  const detailing = readJson('../../config/research/statement-detailing-engine-2026.json');

  const requiredGroups = [
    'web_general_and_meta',
    'official_and_institutional',
    'scholarly',
    'books_and_libraries',
    'images_and_visual_evidence',
    'audio_and_video',
    'documents_and_local_corpus'
  ];
  const missingGroups = requiredGroups.filter((group) => !army.specialistGroups[group]);

  return {
    ok:
      army.policy.freeFirst === true &&
      army.policy.noPaidDependencyRequired === true &&
      missingGroups.length === 0 &&
      trust.agentBoundary.sourceTextCannotInvokeTools === true &&
      trust.transport.blockPrivateNetwork === true &&
      lineage.identity.sourceIdRequired === true &&
      lineage.independence.copiedPagesDoNotCountAsIndependent === true &&
      detailing.rules.never_invent_details === true &&
      gaps.governance.toolsAreNotTruthAuthorities === true,
    missingGroups,
    checks: {
      freeFirst: army.policy.freeFirst === true,
      noPaidDependency: army.policy.noPaidDependencyRequired === true,
      remoteContentUntrusted: trust.content.remoteTextIsDataNotInstructions === true,
      toolInvocationBlockedFromSourceText: trust.agentBoundary.sourceTextCannotInvokeTools === true,
      provenanceRequired: lineage.identity.sourceIdRequired === true,
      independenceClustering: lineage.independence.clusterByOrigin === true,
      noInventedDetails: detailing.rules.never_invent_details === true,
      toolIsNotAuthority: gaps.governance.toolsAreNotTruthAuthorities === true
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = auditGlobalResearchSystem();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}
