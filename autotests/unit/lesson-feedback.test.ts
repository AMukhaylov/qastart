import assert from "node:assert/strict";
import test from "node:test";
import {
  canSkipLessonFeedback,
  canSubmitLessonFeedback,
  validateFeedbackAnswers,
} from "../../src/lib/lesson-feedback-validation.ts";

const questions = [
  { id: "rating", type: "rating" as const, label: "Оцени урок", required: true },
  { id: "good", type: "textarea" as const, label: "Что было хорошо?", required: true },
  { id: "unclear", type: "textarea" as const, label: "Что непонятно?", required: true },
  { id: "improve", type: "textarea" as const, label: "Что улучшить?", required: true },
  {
    id: "difficulty",
    type: "radio" as const,
    label: "Сложность",
    required: true,
    options: [
      { label: "Слишком легко", value: "too_easy" },
      { label: "Нормально", value: "normal" },
      { label: "Сложно", value: "hard" },
      { label: "Слишком сложно", value: "too_hard" },
    ],
  },
  { id: "comment", type: "textarea" as const, label: "Комментарий", required: false },
];
const completeAnswers = {
  rating: 8,
  good: "Понятно",
  unclear: "Всё ясно",
  improve: "Больше примеров",
  difficulty: "normal",
  comment: "",
};

test("feedback unlocks after required blocks when a lesson has no homework", () => {
  assert.equal(
    canSubmitLessonFeedback({
      required: true,
      requiredBlocksComplete: true,
      homeworkExists: false,
      homeworkAccepted: false,
      alreadySubmitted: false,
    }),
    true,
  );
  assert.equal(
    canSubmitLessonFeedback({
      required: true,
      requiredBlocksComplete: false,
      homeworkExists: false,
      homeworkAccepted: false,
      alreadySubmitted: false,
    }),
    false,
  );
});

test("homework lesson keeps survey locked until mentor approval", () => {
  const shared = {
    required: true,
    requiredBlocksComplete: true,
    homeworkExists: true,
    alreadySubmitted: false,
  };
  assert.equal(canSubmitLessonFeedback({ ...shared, homeworkAccepted: false }), false);
  assert.equal(canSubmitLessonFeedback({ ...shared, homeworkAccepted: true }), true);
});

test("disabled feedback leaves previous lesson completion behavior intact", () => {
  assert.equal(
    canSubmitLessonFeedback({
      required: false,
      requiredBlocksComplete: true,
      homeworkExists: false,
      homeworkAccepted: false,
      alreadySubmitted: false,
    }),
    false,
  );
});

test("feedback skipping requires an enabled student group and all lesson prerequisites", () => {
  const shared = {
    required: true,
    groupAllowsSkip: true,
    requiredBlocksComplete: true,
    homeworkExists: false,
    homeworkAccepted: false,
    alreadySubmitted: false,
    alreadySkipped: false,
  };
  assert.equal(canSkipLessonFeedback(shared), true);
  assert.equal(canSkipLessonFeedback({ ...shared, groupAllowsSkip: false }), false);
  assert.equal(canSkipLessonFeedback({ ...shared, requiredBlocksComplete: false }), false);
  assert.equal(
    canSkipLessonFeedback({ ...shared, homeworkExists: true, homeworkAccepted: false }),
    false,
  );
  assert.equal(canSkipLessonFeedback({ ...shared, alreadySubmitted: true }), false);
  assert.equal(canSkipLessonFeedback({ ...shared, alreadySkipped: true }), false);
});

test("required text rejects whitespace and too-short values, but optional comment can be empty", () => {
  assert.equal(validateFeedbackAnswers(questions, completeAnswers).valid, true);
  assert.match(
    validateFeedbackAnswers(questions, { ...completeAnswers, good: "   " }).valid
      ? ""
      : validateFeedbackAnswers(questions, { ...completeAnswers, good: "   " }).error,
    /обязательный/,
  );
  assert.match(
    validateFeedbackAnswers(questions, { ...completeAnswers, improve: "ok" }).valid
      ? ""
      : validateFeedbackAnswers(questions, { ...completeAnswers, improve: "ok" }).error,
    /3 символа/,
  );
});

test("rating is restricted to integer 1 through 10 and radio values are allow-listed", () => {
  for (const rating of [0, 11, 1.5, "NaN"])
    assert.equal(validateFeedbackAnswers(questions, { ...completeAnswers, rating }).valid, false);
  assert.equal(validateFeedbackAnswers(questions, { ...completeAnswers, rating: 1 }).valid, true);
  assert.equal(
    validateFeedbackAnswers(questions, { ...completeAnswers, difficulty: "impossible" }).valid,
    false,
  );
});

test("duplicate question IDs are rejected before saving answers", () => {
  const duplicate = [...questions, questions[0]!];
  const result = validateFeedbackAnswers(duplicate, completeAnswers);
  assert.equal(result.valid, false);
  if (!result.valid) assert.match(result.error, /уникальными/);
});
