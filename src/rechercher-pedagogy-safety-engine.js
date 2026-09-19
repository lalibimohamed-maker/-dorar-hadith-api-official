export const SAFETY_DECISIONS = Object.freeze(['ALLOW', 'REVIEW_REQUIRED', 'BLOCK']);

export function createPedagogySafetyEngine() {
  return { policies: new Map(), decisions: new Map() };
}

export function registerPedagogyPolicy(engine, { policyId, name, blockedStates = ['AI_GENERATED', 'UNKNOWN', 'DISPUTED'] } = {}) {
  if (!policyId || !name) throw new TypeError('policy requires identity and name');
  const policy = { policyId, name, blockedStates: [...blockedStates] };
  engine.policies.set(policyId, policy);
  return policy;
}

export function evaluatePedagogyItem(engine, { decisionId, policyId, evidenceState, rightsStatus = 'UNKNOWN', humanReviewed = false } = {}) {
  if (!engine.policies.has(policyId)) throw new Error(`Unknown policy: ${policyId}`);
  const policy = engine.policies.get(policyId);
  let decision = 'ALLOW';
  if (rightsStatus !== 'ALLOWED') decision = 'BLOCK';
  else if (policy.blockedStates.includes(evidenceState) && !humanReviewed) decision = 'REVIEW_REQUIRED';
  const result = { decisionId, policyId, evidenceState, rightsStatus, humanReviewed, decision };
  engine.decisions.set(decisionId, result);
  return result;
}
