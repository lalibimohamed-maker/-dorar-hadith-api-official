import { buildScholarOpinionBatch } from "../src/scholar-opinions-batch.js";

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, value = ""] = arg.replace(/^--/, "").split("=");
  return [key, value];
}));

const offset = Number(args.offset || 0);
const limit = Number(args.limit || 10);
const query = args.query || "";
const timeoutMs = Number(args.timeout || 10000);

if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
  throw new Error("offset must be >= 0 and limit must be between 1 and 50");
}

const batch = buildScholarOpinionBatch({ offset, limit, query });
const targets = new Map();
for (const item of batch.batches) {
  for (const source of item.sourceTargets || []) {
    targets.set(source.url, { scholarId: item.subjectScholarId, scholarNameAr: item.subjectScholarNameAr, ...source });
  }
}

async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal, headers: { "user-agent": "DeenAllah-Source-Probe/1.0" } });
    const body = await response.text();
    const title = body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || null;
    return { ok: response.ok, status: response.status, finalUrl: response.url, title };
  } catch (error) {
    return { ok: false, error: error.name === "AbortError" ? "timeout" : String(error.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

const results = [];
for (const [url, source] of targets) {
  results.push({ ...source, probe: await probe(url), verification: "unverified" });
}

process.stdout.write(JSON.stringify({
  generatedAt: new Date().toISOString(),
  batch: { offset, limit, query, returned: batch.returned, totalScholars: batch.totalScholars },
  policy: "هذا الفحص يثبت إمكانية الوصول إلى المصدر فقط؛ لا يثبت صحة أي نسبة أو قول، ولا يرقّي أي مادة إلى verified.",
  results,
}, null, 2) + "\n");
