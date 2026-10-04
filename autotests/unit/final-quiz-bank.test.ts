import assert from "node:assert/strict";
import test from "node:test";
import { validateFinalQuizBank } from "../../src/server/final-quiz.bank.ts";
import {
  FINAL_QUIZ_QUESTIONS,
  LEGACY_FINAL_QUIZ_QUESTIONS,
} from "../../src/server/final-quiz.questions.ts";

test("final quiz bank contains 90 valid, unique, course-scoped questions", () => {
  const bank = validateFinalQuizBank(FINAL_QUIZ_QUESTIONS);
  assert.equal(bank.length, 90);
  assert.equal(new Set(bank.map((question) => question.id)).size, 90);
  assert.equal(new Set(bank.map((question) => question.text.toLowerCase().trim())).size, 90);
  assert.ok(
    bank.every((question) =>
      question.options.some((option) => option.id === question.correctOptionId),
    ),
  );

  for (const question of bank) {
    assert.doesNotMatch(question.text, /\b(?:Jira|backlog|daily stand-up|WIP|первичный ключ)\b/i);
  }
  assert.equal(LEGACY_FINAL_QUIZ_QUESTIONS.length, 70);
});

test("final quiz bank importer rejects duplicate questions and missing correct answers", () => {
  const duplicatePrompt = [...FINAL_QUIZ_QUESTIONS];
  duplicatePrompt[1] = { ...duplicatePrompt[1], text: duplicatePrompt[0].text };
  assert.throws(() => validateFinalQuizBank(duplicatePrompt), /Повторяется формулировка/);

  const missingAnswer = [...FINAL_QUIZ_QUESTIONS];
  missingAnswer[0] = { ...missingAnswer[0], correctOptionId: "missing-option" };
  assert.throws(() => validateFinalQuizBank(missingAnswer), /правильный ответ отсутствует/);
});
