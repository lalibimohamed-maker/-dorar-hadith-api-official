import test from 'node:test';
import assert from 'node:assert/strict';
import { validateQuestion, scoreChoice, buildVoiceQuestion } from '../src/learning/flashcard-engine.mjs';

test('choice questions support two or more options and multiple correct answers', () => {
  const question = { questionId:'q1', sourceId:'source-1', mode:'multiple-choice', prompt:'اختر الصحيح', choices:[{id:'a'},{id:'b'},{id:'c'}], correctChoiceIds:['a','c'] };
  assert.equal(validateQuestion(question).ok, true);
  assert.equal(scoreChoice(question, ['c','a']), true);
  assert.equal(scoreChoice(question, ['b']), false);
});

test('voice question keeps microphone permission explicit', () => {
  const question = { questionId:'q2', sourceId:'source-1', mode:'spoken-answer', prompt:'ما اسم السورة؟', microphonePermissionExplicit:true };
  assert.equal(validateQuestion(question).ok, true);
  assert.equal(buildVoiceQuestion(question, 'ar-DZ').requiresMicrophone, true);
});

test('unverified generated religious answers fail closed', () => {
  const question = { questionId:'q3', sourceId:'unknown', mode:'flashcard-recall', machineGeneratedReligiousAnswer:true, sourceVerified:false };
  assert.equal(validateQuestion(question).ok, false);
});
