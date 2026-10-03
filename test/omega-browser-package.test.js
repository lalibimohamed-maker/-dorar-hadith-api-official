import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createOmegaClient } from "../packages/omega-browser/src/omega-client-core.js";
import { verifyEvidenceHit } from "../packages/omega-browser/src/omega-local-bridge.js";

const sourceText = "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ";
const sourceHash = createHash("sha256").update(sourceText, "utf8").digest("hex");

test("browser evidence bridge keeps node_id separate from content_sha256", async () => {
  const verified = await verifyEvidenceHit({
    document: {
      node_id: "hadith:1",
      content_sha256: sourceHash,
      verification_status: "verified",
      citation: "bukhari:1",
      text: sourceText
    }
  });
  assert.equal(verified.node_id, "hadith:1");
  assert.equal(verified.content_sha256, sourceHash);
});

test("browser client never invokes local generation without verified evidence", async () => {
  let localCalls = 0;
  const client = createOmegaClient({
    mode: "offline_only",
    localEvidenceSearch: async () => [{
      document: {
        node_id: "hadith:1",
        content_sha256: "0".repeat(64),
        verification_status: "verified",
        citation: "bukhari:1",
        text: sourceText
      }
    }],
    localGenerate: async () => {
      localCalls += 1;
      return { text: "must-not-run" };
    }
  });

  const result = await client.answer("حديث الأعمال بالنيات");
  assert.equal(result.status, "NO_EVIDENCE_FOUND");
  assert.equal(localCalls, 0);
});

test("browser client passes only verified evidence to local generation", async () => {
  let received = null;
  const client = createOmegaClient({
    mode: "offline_only",
    localEvidenceSearch: async () => [{
      document: {
        node_id: "hadith:1",
        content_sha256: sourceHash,
        verification_status: "verified",
        citation: "bukhari:1",
        text: sourceText
      }
    }],
    localGenerate: async ({ evidence }) => {
      received = evidence;
      return { text: "إجابة محلية" };
    }
  });

  const result = await client.answer("حديث الأعمال بالنيات");
  assert.equal(result.text, "إجابة محلية");
  assert.equal(received.length, 1);
  assert.equal(received[0].node_id, "hadith:1");
  assert.equal(received[0].content_sha256, sourceHash);
});
