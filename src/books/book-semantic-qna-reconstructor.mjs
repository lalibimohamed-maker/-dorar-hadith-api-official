import fs from 'node:fs';
import path from 'node:path';

const CONFIG_PATH = path.resolve('config/book-semantic-digitization-2026.json');

export function loadBookDigitizationConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

const LABEL_RE = /(?:^|\n)\s*(السؤال|الجواب|سؤال|جواب|لماذا|كيف|ما\s+الدليل)\s*[:：]?/g;

/**
 * Convert OCR/layout text into reviewable question/answer blocks.
 * This never declares OCR or generated explanations authoritative.
 */
export function extractQuestionAnswerBlocks(text) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  const matches = [...text.matchAll(LABEL_RE)];
  const blocks = [];
  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const heading = matches[i][1];
    const body = text.slice(start + matches[i][0].length, end).trim();
    blocks.push({ heading, text: body, sourceOffset: start, authoritative: false });
  }
  return blocks;
}

export function buildDerivedBookRecord({ sourcePage, ocrEngines, blocks, sourceSha256 = null }) {
  if (!Number.isInteger(sourcePage) || sourcePage < 1) throw new TypeError('sourcePage must be a positive integer');
  if (!Array.isArray(ocrEngines) || ocrEngines.length === 0) throw new TypeError('ocrEngines must be a non-empty array');
  return {
    schemaVersion: 1,
    source: { page: sourcePage, sha256: sourceSha256, preserveOriginal: true },
    ocr: { engines: ocrEngines, consensusRequired: true },
    semantic: { questionAnswerBlocks: blocks, generatedExplanationAuthoritative: false },
    publication: {
      trustedCorpusMutation: false,
      promotionRequiresVerification: true,
      rightsVerificationRequired: true,
    },
  };
}

export function mergeOcrCandidates(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) throw new TypeError('candidates must be a non-empty array');
  const normalized = candidates.filter((x) => typeof x?.text === 'string' && x.text.trim());
  if (normalized.length === 0) throw new Error('No usable OCR candidate');
  return {
    text: normalized[0].text.trim(),
    alternatives: normalized.slice(1).map((x) => x.text.trim()),
    consensus: normalized.length >= 2,
    authoritative: false,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [command = 'config'] = process.argv.slice(2);
  if (command === 'config') console.log(JSON.stringify(loadBookDigitizationConfig(), null, 2));
  else process.exitCode = 2;
}
