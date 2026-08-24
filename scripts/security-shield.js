#!/usr/bin/env node

import fs from "node:fs";
import { createAuditEvent, detectAnomalies, lockdownStatus } from "../src/security/security-shield.js";

const [, , command = "status", ...args] = process.argv;

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

if (command === "status") {
  print(lockdownStatus());
  process.exit(0);
}

if (command === "audit") {
  const [actor = "unknown", action = "unknown", target = "unknown", result = "unknown", previousHash = "GENESIS"] = args;
  print(createAuditEvent({ actor, action, target, result, previousHash }));
  process.exit(0);
}

if (command === "anomaly") {
  const [path] = args;
  if (!path) throw new Error("Usage: node scripts/security-shield.js anomaly <audit.json>");
  const events = JSON.parse(fs.readFileSync(path, "utf8"));
  print(detectAnomalies(events));
  process.exit(0);
}

process.stderr.write("Usage: node scripts/security-shield.js <status|audit|anomaly> ...\n");
process.exit(2);
