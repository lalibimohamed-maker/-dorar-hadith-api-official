import { planOperation } from "./governance/orchestration-kernel.js";

const ROUTES = Object.freeze({
  read: "read",
  discover: "search",
  transform: "transform",
  write: "write",
  publish: "publish",
  export: "export"
});

const RISK = Object.freeze({
  read: "low",
  discover: "medium",
  transform: "medium",
  write: "high",
  publish: "critical",
  export: "high"
});

function normalize(operation = {}) {
  const action = String(operation.action || "").trim();
  return {
    ...operation,
    action,
    requestId: operation.requestId || "unassigned",
    actor: operation.actor || "system",
    risk: operation.risk || RISK[action] || "unknown"
  };
}

/**
 * Small, deterministic orchestration boundary.
 *
 * It does not execute network/cyber actions. It only decides whether an
 * already-requested operation is allowed to proceed and records the gates
 * that must have passed. Unknown or unsafe operations fail closed.
 */
export function planOrchestration(operation, policy) {
  const normalized = normalize(operation);
  if (!ROUTES[normalized.action]) {
    const error = new Error("Unknown operation: fail closed");
    error.code = "ORCHESTRATION_ACTION_UNKNOWN";
    throw error;
  }

  const governance = planOperation(normalized, policy);
  return Object.freeze({
    version: 1,
    requestId: normalized.requestId,
    actor: normalized.actor,
    route: ROUTES[normalized.action],
    risk: normalized.risk,
    status: governance.status,
    gates: governance.gates,
    governance
  });
}

export function requiredGates(action) {
  const normalized = String(action || "");
  if (!ROUTES[normalized]) return Object.freeze([]);
  const gates = ["provenance"];
  if (["write", "publish", "export"].includes(normalized)) gates.push("validation");
  if (["publish", "export"].includes(normalized)) gates.push("rights");
  return Object.freeze(gates);
}
