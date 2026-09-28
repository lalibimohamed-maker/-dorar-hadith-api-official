import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  QURAN_BASE_LAYER,
  QURAN_KNOWLEDGE_TRACKS,
  canIngestQuranKnowledgeFullText,
  classifyQuranKnowledgeLayer,
  validateQuranKnowledgeWork,
} from "../src/quran-knowledge-library.js";

const catalog = JSON.parse(fs.readFileSync(new URL("../data/quran-knowledge-catalog.json", import.meta.url), "utf8"));

test("Quran knowledge catalog contains exactly three independent knowledge tracks", () => {
  assert.deepEqual(catalog.categories.map(item => item.id), [
    "tafsir",
    "tadabbur",
    "visual-learning",
  ]);
  assert.deepEqual(catalog.separation.tracks, QURAN_KNOWLEDGE_TRACKS);
  assert.equal(catalog.separation.quranText.id, QURAN_BASE_LAYER);
});

test("catalog includes the requested seed works without merging categories", () => {
  const byTitle = new Map(
    catalog.categories.flatMap(category =>
      category.seedWorks.map(work => [work.title, category.id])
    )
  );

  for (const title of [
    "جامع البيان عن تأويل آي القرآن",
    "تفسير القرآن العظيم",
    "تيسير الكريم الرحمن في تفسير كلام المنان",
    "تفسير الجلالين",
    "التفسير الميسر",
    "التفسير الوسيط للقرآن الكريم",
  ]) assert.equal(byTitle.get(title), "tafsir");

  for (const title of [
    "القرآن تدبر وعمل",
    "هدايات القرآن الكريم",
    "جعلناه نورا",
  ]) assert.equal(byTitle.get(title), "tadabbur");
});

test("every work carries independent identity, rights, provenance and ingestion records", () => {
  for (const category of catalog.categories) {
    for (const work of category.seedWorks) {
      assert.equal(work.contentLayer, category.id);
      assert.ok(work.workId);
      assert.ok(work.title);
      assert.ok(work.sourceRef);
      assert.ok(work.rights);
      assert.equal(work.rights.redistributionAllowed, false);
      assert.ok(work.ingestion);
      assert.equal(work.ingestion.fullTextAllowed, false);
      assert.ok(work.provenance);
    }
  }
});

test("secondary sources are discovery-only and full-text ingestion requires verified rights", () => {
  assert.equal(catalog.policy.sourcePriority[0], "official");
  assert.equal(catalog.policy.secondarySourcesAreDiscoveryOnly, true);
  assert.equal(catalog.policy.fullTextIngestionRequires.rights, true);

  const candidate = catalog.categories.find(item => item.id === "tadabbur").seedWorks[0];
  const decision = canIngestQuranKnowledgeFullText(candidate);
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "provenance_not_complete");
});

test("Quran text remains separate from derived knowledge works", () => {
  const quran = classifyQuranKnowledgeLayer({ contentLayer: "quran-text" });
  assert.equal(quran.allowed, true);
  assert.equal(quran.authoritative, true);

  const tafsir = classifyQuranKnowledgeLayer({
    contentLayer: "tafsir",
    scientificRole: "tafsir-of-quran",
  });
  assert.equal(tafsir.allowed, true);
  assert.equal(tafsir.authoritative, false);

  const mixed = classifyQuranKnowledgeLayer({
    contentLayer: "tafsir",
    scientificRole: "tadabbur-and-hidayat",
  });
  assert.equal(mixed.allowed, false);
});

test("work validation fails closed for unknown layers and invalid rights", () => {
  const base = {
    workId: "test-1",
    contentLayer: "tafsir",
    title: "Test Tafsir",
    author: "Author",
    sourceRef: "source",
    sourceTier: "institutional",
    status: "candidate",
    rights: { status: "not_verified", redistributionAllowed: false },
    ingestion: { method: null, fullTextAllowed: false },
    provenance: {
      authorVerified: false,
      titleVerified: true,
      editionVerified: false,
      sourceVerified: false,
      checkedAt: null,
    },
    scientificRole: "tafsir-of-quran",
  };
  assert.equal(validateQuranKnowledgeWork(base).valid, true);
  assert.equal(validateQuranKnowledgeWork({
    ...base,
    contentLayer: "unknown",
  }).valid, false);
  assert.equal(validateQuranKnowledgeWork({
    ...base,
    rights: { status: "invented", redistributionAllowed: true },
  }).valid, false);
});

test("a fully evidenced work may pass the full-text gate", () => {
  const work = {
    workId: "verified-1",
    contentLayer: "tafsir",
    title: "Verified Tafsir",
    author: "Author",
    edition: "1st",
    sourceRef: "official-source",
    sourceTier: "official_institutional",
    status: "verified",
    scientificRole: "tafsir-of-quran",
    rights: {
      status: "licensed",
      redistributionAllowed: true,
      evidence: "license-record-1",
    },
    provenance: {
      authorVerified: true,
      titleVerified: true,
      editionVerified: true,
      sourceVerified: true,
      checkedAt: "2026-09-28T00:00:00Z",
    },
    ingestion: {
      method: "authorized-import",
      verifiedAt: "2026-09-28T00:00:00Z",
      validationStatus: "valid",
      fullTextAllowed: true,
    },
  };
  const decision = canIngestQuranKnowledgeFullText(work);
  assert.equal(decision.allowed, true);
});
