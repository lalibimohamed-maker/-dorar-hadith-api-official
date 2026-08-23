import assert from "node:assert/strict";
import test from "node:test";
import { createMemorizationSession, advanceMemorizationCycle, getMemorizationLimits } from "../src/quran-memorization.js";

test("memorization session supports 1-20 ayahs and repetitions", () => {
  assert.deepEqual(getMemorizationLimits(), { minAyahs: 1, maxAyahs: 20, minRepeats: 1, maxRepeats: 20 });
  const session = createMemorizationSession({ surah: "البقرة", startAyah: 1, endAyah: 10, repeatCount: 5 });
  assert.equal(session.ayahCount, 10);
  assert.equal(session.repeatCount, 5);
  assert.equal(session.currentCycle, 1);
  assert.equal(session.status, "ready");
  assert.equal(session.tajweed.enabled, true);
});

test("memorization cycles restart at selected start ayah", () => {
  let session = createMemorizationSession({ surah: "الفاتحة", startAyah: 1, endAyah: 7, repeatCount: 3 });
  session = advanceMemorizationCycle(session);
  assert.equal(session.currentCycle, 2);
  assert.equal(session.currentAyah, 1);
  session = advanceMemorizationCycle(session);
  assert.equal(session.currentCycle, 3);
  session = advanceMemorizationCycle(session);
  assert.equal(session.status, "completed");
});
