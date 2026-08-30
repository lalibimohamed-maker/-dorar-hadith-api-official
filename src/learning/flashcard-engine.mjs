import fs from 'node:fs';
import path from 'node:path';

const CONFIG_PATH = path.resolve('config/flashcard-learning-2026.json');

export function loadFlashcardConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

export function validateQuestion(question) {
  const cfg = loadFlashcardConfig();
  const errors = [];
  if (!question || typeof question !== 'object') return { ok: false, errors: ['question must be an object'] };
  if (!question.questionId) errors.push('questionId is required');
  if (!question.sourceId) errors.push('sourceId is required');
  if (!cfg.questionModes.includes(question.mode)) errors.push('unsupported question mode');
  if (['single-choice', 'multiple-choice'].includes(question.mode)) {
    const count = Array.isArray(question.choices) ? question.choices.length : 0;
    if (count < cfg.answerOptions.minimumChoices) errors.push('at least two choices are required');
    if (!Array.isArray(question.correctChoiceIds) || question.correctChoiceIds.length < 1) errors.push('correctChoiceIds is required');
  }
  if (question.mode === 'spoken-answer' && question.microphonePermissionExplicit !== true) errors.push('microphone permission must be explicit');
  if (question.machineGeneratedReligiousAnswer && question.sourceVerified !== true) errors.push('generated religious answer requires verified source');
  return { ok: errors.length === 0, errors };
}

export function scoreChoice(question, selectedIds) {
  if (!['single-choice', 'multiple-choice'].includes(question.mode)) throw new Error('not a choice question');
  const expected = [...question.correctChoiceIds].sort();
  const actual = [...new Set(selectedIds)].sort();
  return expected.length === actual.length && expected.every((id, i) => id === actual[i]);
}

export function buildVoiceQuestion(question, locale) {
  const cfg = loadFlashcardConfig();
  if (!cfg.voice.questionDelivery) throw new Error('voice delivery unavailable');
  return {
    locale,
    text: question.prompt,
    engine: cfg.voice.webSpeechPreferred ? 'Web Speech / device voice' : 'approved-local-tts',
    requiresMicrophone: question.mode === 'spoken-answer'
  };
}
