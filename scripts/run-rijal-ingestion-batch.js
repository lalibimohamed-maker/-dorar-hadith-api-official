import { buildRijalIngestionBatch } from "../src/rijal-ingestion.js";

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.join("=") || true];
}));

const sourceId = args.get("source") === true ? undefined : args.get("source");
const offset = Number(args.get("offset") || 0);
const limit = Number(args.get("limit") || 100);

console.log(JSON.stringify(buildRijalIngestionBatch({ sourceId, offset, limit }), null, 2));
