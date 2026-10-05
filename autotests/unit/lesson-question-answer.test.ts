import assert from "node:assert/strict";
import test from "node:test";
import { buildLessonQuestionAnswer, sameIndexes } from "../../src/lib/lesson-question-answer.ts";

test("single-choice answers are graded against the lesson block, not client claims", () => {
  const answer = buildLessonQuestionAnswer(
    {
      question: "  Что верно? ",
      options: ["Да", "Нет"],
      correctIndex: 0,
    },
    [1],
  );

  assert.equal(answer.questionText, "Что верно?");
  assert.deepEqual(answer.selectedIndexes, [1]);
  assert.deepEqual(answer.correctIndexes, [0]);
  assert.equal(answer.isCorrect, false);
});

test("multiple-choice answers require the exact correct option set", () => {
  const content = {
    questionType: "multiple_choice",
    question: "Выбери оба ответа",
    options: ["А", "Б", "В"],
    correctAnswers: [0, 2],
  };

  assert.equal(buildLessonQuestionAnswer(content, [2, 0]).isCorrect, true);
  assert.equal(buildLessonQuestionAnswer(content, [0]).isCorrect, false);
  assert.equal(buildLessonQuestionAnswer(content, [0, 1, 2]).isCorrect, false);
});

test("malformed or duplicate indexes are rejected and retries compare normalized indexes", () => {
  const content = { question: "Q?", options: ["A", "B"], correctIndex: 0 };
  assert.throws(() => buildLessonQuestionAnswer(content, [2]), /Некорректный ответ/);
  assert.throws(() => buildLessonQuestionAnswer(content, [0, 0]), /Некорректный ответ/);
  assert.throws(
    () => buildLessonQuestionAnswer({ ...content, options: ["A", 3] }, [0]),
    /Некорректный ответ/,
  );
  assert.equal(sameIndexes([0, 2], [0, 2]), true);
  assert.equal(sameIndexes([0, 2], [2, 0]), false);
});
