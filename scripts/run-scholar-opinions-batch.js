import { buildScholarOpinionBatch } from "../src/scholar-opinions-batch.js";

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, value = ""] = arg.replace(/^--/, "").split("=");
  return [key, value];
}));

const offset = Number(args.offset || 0);
const limit = Number(args.limit || 25);
const query = args.query || "";
if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 200) {
  throw new Error("offset must be >= 0 and limit must be between 1 and 200");
}

process.stdout.write(`${JSON.stringify(buildScholarOpinionBatch({ offset, limit, query }), null, 2)}\n`);
