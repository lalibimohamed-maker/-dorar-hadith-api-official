import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(fs.readFileSync(path.join(root, "config", "homepage-identity-system-2026.json"), "utf8"));

test("homepage keeps the fixed brand and Quran verse", () => {
  assert.equal(config.brandName, "موسوعة دين الله");
  assert.match(config.hero.arabic, /آل عمران: 85/);
  assert.equal(config.hero.translationOnlyBelow, true);
  assert.equal(config.hero.showSourceMetadataInHero, false);
  assert.equal(config.hero.showTranslatorMetadataInHero, false);
  assert.equal(config.hero.showVerificationMetadataInHero, false);
});

test("homepage language routing preserves Arabic as canonical and uses selected language below", () => {
  assert.equal(config.languageRouting.arabicOriginalAlwaysCanonical, true);
  assert.equal(config.languageRouting.translationUnderHeroUsesSelectedLanguage, true);
  assert.equal(config.languageRouting.priorityLanguages.length, 20);
  assert.equal(config.internalProvenance.exposeOnVerificationViews, true);
  assert.equal(config.internalProvenance.doNotExposeInHero, true);
});
