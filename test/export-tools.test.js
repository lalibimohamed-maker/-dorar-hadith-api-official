import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("export tools provide copy PDF DOCX speech and long-form Quran controls", () => {
  const html = fs.readFileSync("web/index.html", "utf8");
  const js = fs.readFileSync("web/export-tools.js", "utf8");
  assert.match(html, /export-tools\.js/);
  assert.match(js, /data-export=\"copy\"/);
  assert.match(js, /data-export=\"pdf\"/);
  assert.match(js, /data-export=\"docx\"/);
  assert.match(js, /data-export=\"speak\"/);
  assert.match(js, /quran-download-panel/);
  assert.match(js, /سعد الغامدي/);
  assert.match(js, /وادي اليماني/);
  assert.match(js, /لا ننشئ رابط MP3 مباشرًا/);
});
