export const FEEDBACK_TYPES = Object.freeze(['CORRECT','PARTIAL','NEEDS_SOURCE','NEEDS_CLARIFICATION']);

export function createTeachBackEngine() {
  return { prompts: new Map(), responses: new Map(), feedback: new Map() };
}

export function createTeachBackPrompt(engine, { promptId, learnerId, conceptId, sourceIds = [], level = 'STUDENT' } = {}) {
  if (!promptId || !learnerId || !conceptId) throw new TypeError('Teach-back prompt requires learner and concept');
  const prompt = { promptId, learnerId, conceptId, sourceIds: [...sourceIds], level, status: 'OPEN' };
  engine.prompts.set(promptId, prompt);
  return prompt;
}

export function submitTeachBack(engine, { responseId, promptId, text, sourceIds = [] } = {}) {
  if (!responseId || !promptId || !text) throw new TypeError('Teach-back response requires response, prompt and text');
  if (!engine.prompts.has(promptId)) throw new Error(`Unknown teach-back prompt: ${promptId}`);
  const response = { responseId, promptId, text, sourceIds: [...sourceIds], status: 'AWAITING_FEEDBACK' };
  engine.responses.set(responseId, response);
  return response;
}

export function reviewTeachBack(engine, { responseId, reviewerId, feedbackType, note = '', sourceIds = [] } = {}) {
  if (!responseId || !reviewerId || !FEEDBACK_TYPES.includes(feedbackType)) throw new TypeError('Invalid teach-back feedback');
  if (!engine.responses.has(responseId)) throw new Error(`Unknown teach-back response: ${responseId}`);
  const feedback = { responseId, reviewerId, feedbackType, note, sourceIds: [...sourceIds], reviewedAt: new Date().toISOString() };
  engine.feedback.set(responseId, feedback);
  engine.responses.get(responseId).status = feedbackType;
  return feedback;
}
