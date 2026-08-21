import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { detectLocale, listLocales, localeFromRequest } from "../src/i18n.js";

const AGREED = ["ar","en","zh","ko","bn","pl","fr","es","it","de","ru","ja","hi","fi","ber","tr","id","ms","ur","fa"];

test("exactly 20 launch locales are configured and extensible", () => {
  const codes = listLocales().map((locale) => locale.code);
  assert.equal(codes.length, 20);
  assert.deepEqual(codes, AGREED);
});

test("central locale config stays synchronized with runtime locales", () => {
  const config = JSON.parse(fs.readFileSync(new URL("../config/i18n.json", import.meta.url), "utf8"));
  assert.equal(config.launchLocaleCount, 20);
  assert.equal(config.allowFutureExpansion, true);
  assert.deepEqual(config.languages.map((locale) => locale.code), AGREED);
});

test("explicit locale selection has priority", () => {
  assert.equal(localeFromRequest("de", "What are the pillars of Islam?").code, "de");
});

test("query language can override the device/settings language", () => {
  assert.equal(detectLocale("What are the five pillars of Islam?")?.code, "en");
  assert.equal(detectLocale("Quels sont les cinq piliers de l'Islam ?")?.code, "fr");
  assert.equal(detectLocale("Quali sono i cinque pilastri dell'Islam?")?.code, "it");
  assert.equal(detectLocale("Was sind die fünf Säulen des Islam?")?.code, "de");
  assert.equal(detectLocale("Что такое ислам и хадис?")?.code, "ru");
  assert.equal(detectLocale("イスラムとは何ですか")?.code, "ja");
  assert.equal(detectLocale("इस्लाम के पांच स्तंभ क्या हैं?")?.code, "hi");
});

test("source text policy is represented by locale metadata", () => {
  assert.equal(listLocales().find((locale) => locale.code === "ar").dir, "rtl");
  assert.equal(listLocales().find((locale) => locale.code === "ur").dir, "rtl");
  assert.equal(listLocales().find((locale) => locale.code === "fa").dir, "rtl");
});
