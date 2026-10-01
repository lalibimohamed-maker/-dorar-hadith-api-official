import fs from "node:fs";
const cfg = JSON.parse(fs.readFileSync("config/quran-institutional-acquisition-2026-09-22.json", "utf8"));
if (cfg.policy.canonical_arabic_separate !== true) throw new Error("canonical Arabic must stay separate");
if (cfg.policy.ai_generated_translation_forbidden !== true) throw new Error("AI-generated Quran translation must stay forbidden");
if (cfg.policy.corpus_write_forbidden !== true) throw new Error("Corpus writes must stay forbidden");
if (cfg.editions.length !== 3) throw new Error("expected 3 institutional acquisition editions");
for (const e of cfg.editions) {
  if (!/^https:\/\//.test(e.asset_url)) throw new Error(`asset URL must be HTTPS: ${e.edition_id}`);
  if (e.rights_verification !== "pending") throw new Error(`rights must remain pending: ${e.edition_id}`);
  if (e.public_publishable !== false) throw new Error(`institutional acquisition must stay research-only: ${e.edition_id}`);
}
console.log("Institutional Quran acquisition governance OK");
