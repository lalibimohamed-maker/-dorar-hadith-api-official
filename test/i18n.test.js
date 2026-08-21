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

test("query language overrides settings/device locale", () => {
  assert.equal(localeFromRequest("de", "What are the pillars of Islam?").code, "en");
  assert.equal(localeFromRequest("en", "Quels sont les cinq piliers de l'Islam ?").code, "fr");
  assert.equal(localeFromRequest("ar", "Was sind die fünf Säulen des Islam?").code, "de");
});

test("settings locale is used when the query is empty or undetectable", () => {
  assert.equal(localeFromRequest("de", "").code, "de");
  assert.equal(localeFromRequest("fr", "12345").code, "fr");
  assert.equal(localeFromRequest("xx", "12345").code, "ar");
});

test("query language detection covers the key non-Latin launch languages", () => {
  assert.equal(detectLocale("Что такое ислам и хадис?")?.code, "ru");
  assert.equal(detectLocale("イスラムとは何ですか")?.code, "ja");
  assert.equal(detectLocale("इस्लाम के पांच स्तंभ क्या हैं?")?.code, "hi");
  assert.equal(detectLocale("伊斯兰教的五大支柱是什么？")?.code, "zh");
  assert.equal(detectLocale("이슬람의 다섯 기둥은 무엇입니까?")?.code, "ko");
});

test("source text policy is represented by locale metadata", () => {
  assert.equal(listLocales().find((locale) => locale.code === "ar").dir, "rtl");
  assert.equal(listLocales().find((locale) => locale.code === "ur").dir, "rtl");
  assert.equal(listLocales().find((locale) => locale.code === "fa").dir, "rtl");
});
