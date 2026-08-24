/**
 * Governance enforcement gate.
 *
 * Turns the governance mesh from a planning component into an executable
 * control boundary. Adapters call this gate before performing a sensitive
 * operation; the gate never grants permissions and never executes arbitrary
 * work unless the caller has explicitly supplied an executor.
 */

import { createExecutionPlan } from './algorithmic-governance-mesh.js';

const ACTIONS_REQUIRING_AUDIT = new Set([
  'create', 'write', 'update', 'execute', 'correct', 'transform',
  'delete', 'publish', 'download'
]);

function requireFunction(value, name) {
  if (typeof value !== 'function') {
    throw new TypeError(`${name} must be a function`);
  }
}

export async function runGovernedOperation({
  request = {},
  execute,
  validateOutput,
  audit,
  checkpoint,
  quarantine,
  now = () => new Date().toISOString()
} = {}) {
  requireFunction(execute, 'execute');

  const plan = createExecutionPlan(request);
  if (!plan.allowed) return { status: 'denied', plan };

  const event = {
    action: plan.action,
    target: request.target ?? null,
    startedAt: now(),
    status: 'started'
  };

  if (ACTIONS_REQUIRING_AUDIT.has(plan.action)) {
    requireFunction(audit, 'audit');
    await audit({ ...event, phase: 'authorize', controls: plan.controls });
  }

  if (plan.reversible) {
    requireFunction(checkpoint, 'checkpoint');
    await checkpoint({ action: plan.action, target: request.target ?? null });
  }

  let result;
  try {
    result = await execute(plan);
  } catch (error) {
    if (typeof quarantine === 'function') {
      await quarantine({ ...event, status: 'execution-failed', error });
    }
    if (typeof audit === 'function') {
      await audit({ ...event, status: 'execution-failed', error: String(error) });
    }
    throw error;
  }

  if (typeof validateOutput === 'function') {
    const validation = await validateOutput(result, plan);
    if (validation !== true) {
      if (typeof quarantine === 'function') {
        await quarantine({ ...event, status: 'output-rejected', result, validation });
      }
      if (typeof audit === 'function') {
        await audit({ ...event, status: 'output-rejected', validation });
      }
      return { status: 'quarantined', plan, result: null, validation };
    }
  }

  if (typeof audit === 'function') {
    await audit({ ...event, status: 'completed', completedAt: now() });
  }

  return { status: 'completed', plan, result };
}
