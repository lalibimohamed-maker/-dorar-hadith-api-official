import { strict as assert } from 'node:assert';
import { createMultimodalSession } from '../src/multimodal-runtime.js';
import { QURAN_QIRAAT_CATALOG, isValidRiwayah } from '../src/quran-qiraat-catalog.js';

const session = createMultimodalSession({ language: 'ar' });
assert.equal(session.output.quranRecitation.policy, 'arabic-recitation-only');
assert.equal(session.output.quranRecitation.selection.qiraah, true);
assert.equal(session.output.quranRecitation.selection.riwayah, true);
assert.equal(QURAN_QIRAAT_CATALOG.length, 10);
assert.equal(isValidRiwayah('asim', 'hafs'), true);
assert.equal(isValidRiwayah('asim', 'warsh'), false);
