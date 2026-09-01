import fs from 'node:fs';

const file = process.argv[2];
if (!file) throw new Error('Usage: node validate-scorecard.mjs <scorecard.json>');

const scorecard = JSON.parse(fs.readFileSync(file, 'utf8'));
const required = [
  ['experimentId'],
  ['candidate', 'checkpoint'],
  ['candidate', 'upstreamRevision'],
  ['prompt', 'suiteId'],
  ['prompt', 'promptId'],
  ['prompt', 'promptSha256'],
  ['runtime', 'provider'],
  ['runtime', 'gpu'],
  ['runtime', 'runtimeImage'],
  ['media', 'sha256'],
  ['rights', 'termsUrl'],
  ['rights', 'inputRights'],
  ['rights', 'checkpointStatus'],
];

const missing = required.filter((path) => {
  let value = scorecard;
  for (const key of path) value = value?.[key];
  return value === undefined || value === null || value === '' || value === 'REQUIRED' || value === 'REPLACE_WITH_RUN_ID';
});

if (missing.length) {
  console.error(JSON.stringify({ status: 'blocked', missing: missing.map((p) => p.join('.')) }, null, 2));
  process.exit(1);
}

if (scorecard.evaluation?.humanReviewRequired !== true) {
  throw new Error('humanReviewRequired must remain true');
}
if (scorecard.publication?.generatedVideoIsEvidence !== false) {
  throw new Error('generated video must never be treated as evidence');
}
if (scorecard.publication?.quranTextEmbedded !== false || scorecard.publication?.quranRecitationEmbedded !== false) {
  throw new Error('Quran text/recitation must remain outside the generation asset');
}

console.log(JSON.stringify({ status: 'ready_for_benchmark_submission' }, null, 2));
