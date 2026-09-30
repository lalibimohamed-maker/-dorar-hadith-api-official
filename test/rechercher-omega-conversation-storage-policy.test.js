import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
test("conversation storage policy is digest-only and Corpus-isolated",()=>{
 const d=JSON.parse(fs.readFileSync("config/rechercher-omega-conversation-storage-2026.json","utf8"));
 assert.equal(d.policy.raw_conversation_persistence,false);
 assert.equal(d.policy.digest_only_persistence,true);
 assert.equal(d.policy.corpus_write_allowed,false);
 assert.equal(d.redis.password_env,"REDIS_PASSWORD");
});
