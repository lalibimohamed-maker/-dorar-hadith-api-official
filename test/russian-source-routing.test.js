import test from "node:test";
import assert from "node:assert/strict";
import { listSources, listRussianSources, getRussianRouting } from "../src/source-registry.js";

const EXPECTED_IDS = [
  "islamic-books-russian-archive",
  "minhadj-ru",
  "toislam-ru",
  "alhadis-ru",
  "islamqa-ru",
  "sunnaportal-ru",
  "asar-forum-ru",
  "islamenc-global"
];

test("Russian source network is registered and ordered", () => {
  const routing = getRussianRouting();
  assert.equal(routing.locale, "ru");
  assert.deepEqual(routing.primarySourceIds, EXPECTED_IDS);
  assert.equal(listRussianSources().length, 8);
  assert.deepEqual(
    listRussianSources().sort((a, b) => a.priority - b.priority).map((source) => source.id),
    EXPECTED_IDS
  );
});

test("Russian source entries are exposed through the general source registry", () => {
  const ids = new Set(listSources({ category: "russian" }).map((source) => source.id));
  for (const id of EXPECTED_IDS.slice(0, 7)) assert.ok(ids.has(id));
});

test("Russian downloads prefer Russian/official routes but remain rights-aware", () => {
  const archive = listRussianSources().find((source) => source.id === "islamic-books-russian-archive");
  const islamqa = listRussianSources().find((source) => source.id === "islamqa-ru");
  assert.equal(archive.downloadPolicy, "download_and_ingest_after_item_level_rights_and_integrity_check");
  assert.equal(islamqa.downloadPolicy, "official_download_or_navigation_only_unless_rights_are_verified");
  assert.ok(listRussianSources({ downloadable: true }).length >= 5);
});
