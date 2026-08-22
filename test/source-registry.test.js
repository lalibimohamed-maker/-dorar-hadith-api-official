import test from "node:test";
import assert from "node:assert/strict";
import { getSource, listCategories, listSources } from "../src/source-registry.js";

test("source registry exposes fatwa category", () => {
  const category = listCategories().find((item) => item.id === "fatwa");
  assert.ok(category);
  assert.equal(category.nameAr, "الفتاوى ومصادر العلماء");
});

test("expanded fatwa sources are queryable with attribution metadata", () => {
  const sources = listSources({ category: "fatwa" });
  assert.ok(sources.length >= 10);
  assert.ok(sources.some((source) => source.id === "binbaz-official"));
  assert.ok(sources.some((source) => source.id === "binothaimeen-official"));
  assert.ok(sources.some((source) => source.id === "scholar-saad-al-shathri"));
  for (const source of sources) {
    assert.ok(source.url);
    assert.ok(source.role);
  }
});

test("individual expanded source retains original attribution", () => {
  const source = getSource("binbaz-official");
  assert.equal(source.scholar, "عبد العزيز بن باز");
  assert.equal(source.url, "https://binbaz.org.sa/");
  assert.equal(source.category, "fatwa");
});
