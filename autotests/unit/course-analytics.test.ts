import assert from "node:assert/strict";
import test from "node:test";
import { buildCourseAnalytics } from "../../src/lib/course-analytics.ts";

const now = new Date("2026-10-05T12:00:00.000Z");
const startedAt = "2026-09-01T10:00:00.000Z";
const finishedAt = "2026-09-01T10:20:00.000Z";

test("course analytics aggregates completion, inactivity, homework and quiz question answers", () => {
  const analytics = buildCourseAnalytics({
    now,
    students: [
      {
        id: "student-1",
        full_name: "Анна Тест",
        login: "anna",
        created_at: "2026-08-01T00:00:00.000Z",
      },
      {
        id: "student-2",
        full_name: "Борис",
        login: "boris",
        created_at: "2026-08-02T00:00:00.000Z",
      },
    ],
    lessons: [
      { id: "lesson-1", day_number: 1, title: "Урок 1" },
      { id: "lesson-14", day_number: 14, title: "Итоговый тест" },
    ],
    progress: [
      {
        user_id: "student-1",
        lesson_id: "lesson-1",
        completed: true,
        completed_at: "2026-09-01T09:00:00.000Z",
        created_at: "2026-09-01T09:00:00.000Z",
      },
      {
        user_id: "student-1",
        lesson_id: "lesson-14",
        completed: true,
        completed_at: finishedAt,
        created_at: finishedAt,
      },
    ],
    blockProgress: [
      { user_id: "student-1", lesson_id: "lesson-1", completed_at: "2026-09-01T08:00:00.000Z" },
      { user_id: "student-1", lesson_id: "lesson-2", completed_at: "2026-09-01T08:10:00.000Z" },
    ],
    submissions: [
      {
        user_id: "student-1",
        lesson_id: "lesson-1",
        status: "approved",
        created_at: "2026-09-01T09:00:00.000Z",
        reviewed_at: "2026-09-01T11:00:00.000Z",
      },
    ],
    homeworkBlocks: [],
    sqlAttempts: [],
    lessonQuestionAnswers: [
      {
        lesson_id: "lesson-1",
        block_id: "block-question-1",
        question_text: "Какой результат ожидается?",
        options: ["Успех", "Ошибка 500"],
        selected_indexes: [1],
        correct_indexes: [0],
        is_correct: false,
      },
      {
        lesson_id: "lesson-1",
        block_id: "block-question-1",
        question_text: "Какой результат ожидается?",
        options: ["Успех", "Ошибка 500"],
        selected_indexes: [0],
        correct_indexes: [0],
        is_correct: true,
      },
    ],
    quizAttempts: [
      {
        user_id: "student-1",
        question_order: {
          questionIds: ["q-1"],
          questionsById: {
            "q-1": {
              id: "q-1",
              topic: "HTTP",
              text: "Что означает код 404?",
              correctOptionId: "a",
              options: [
                { id: "a", text: "Не найдено" },
                { id: "b", text: "Ошибка сервера" },
              ],
            },
          },
        },
        answers: { "q-1": "b" },
        percentage: 0,
        passed: false,
        timed_out: false,
        disqualified: false,
        started_at: startedAt,
        finished_at: finishedAt,
      },
      {
        user_id: "student-1",
        question_order: {
          questionIds: ["q-1"],
          questionsById: {
            "q-1": {
              id: "q-1",
              topic: "HTTP",
              text: "Что означает код 404?",
              correctOptionId: "a",
              options: [
                { id: "a", text: "Не найдено" },
                { id: "b", text: "Ошибка сервера" },
              ],
            },
          },
        },
        answers: { "q-1": "a" },
        percentage: 100,
        passed: true,
        timed_out: false,
        disqualified: false,
        started_at: startedAt,
        finished_at: finishedAt,
      },
    ],
  });

  assert.equal(analytics.totals.students, 2);
  assert.equal(analytics.totals.started, 1);
  assert.equal(analytics.totals.completed, 1);
  assert.equal(analytics.totals.manualHomeworkApproved, 1);
  assert.equal(analytics.totals.medianFinalQuizMinutes, 20);
  assert.equal(
    analytics.students.find((student) => student.id === "student-1")?.passedCourse,
    true,
  );
  assert.equal(analytics.students.find((student) => student.id === "student-2")?.idleDays, null);
  assert.equal(analytics.questionStats[0]?.seen, 2);
  assert.equal(analytics.questionStats[0]?.accuracyPercent, 50);
  assert.equal(analytics.questionStats[0]?.topWrongOption, "Ошибка сервера");
  assert.equal(analytics.lessonQuestionStats[0]?.answered, 2);
  assert.equal(analytics.lessonQuestionStats[0]?.accuracyPercent, 50);
  assert.equal(analytics.lessonQuestionStats[0]?.topWrongOption, "Ошибка 500");
  assert.deepEqual(analytics.lessonQuestionStats[0]?.options, [
    { text: "Успех", count: 1 },
    { text: "Ошибка 500", count: 1 },
  ]);
  assert.equal(analytics.homeworkTimingTracked, false);
});

test("student completion is tied to a passed final quiz, not lesson 14 progress alone", () => {
  const analytics = buildCourseAnalytics({
    now,
    students: [{ id: "student-1", full_name: null, login: "", created_at: null }],
    lessons: [{ id: "lesson-14", day_number: 14, title: "Итоговый тест" }],
    progress: [
      {
        user_id: "student-1",
        lesson_id: "lesson-14",
        completed: true,
        completed_at: finishedAt,
        created_at: finishedAt,
      },
    ],
    blockProgress: [],
    submissions: [],
    homeworkBlocks: [],
    sqlAttempts: [],
    lessonQuestionAnswers: [],
    quizAttempts: [],
  });
  assert.equal(analytics.students[0]?.passedCourse, false);
  assert.equal(analytics.totals.completed, 0);
});
