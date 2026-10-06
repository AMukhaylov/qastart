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
      { id: "lesson-1", day_number: 1, title: "Урок 1", homework_md: "ДЗ 1" },
      { id: "lesson-2", day_number: 2, title: "Урок 2" },
      { id: "lesson-14", day_number: 14, title: "Итоговый тест" },
    ],
    progress: [
      {
        id: "submission-1",
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
      {
        id: "submission-2",
        user_id: "student-2",
        lesson_id: "lesson-2",
        status: "awaiting_mentor",
        created_at: "2026-09-01T08:30:00.000Z",
        reviewed_at: null,
      },
    ],
    homeworkMessages: [
      {
        submission_id: "submission-1",
        user_id: "student-1",
        author_role: "student",
        created_at: "2026-09-01T09:00:00.000Z",
      },
      {
        submission_id: "submission-2",
        user_id: "student-2",
        author_role: "student",
        created_at: "2026-09-01T08:30:00.000Z",
      },
    ],
    homeworkBlocks: [],
    sqlAttempts: [],
    lessonQuestionAnswers: [
      {
        user_id: "student-1",
        lesson_id: "lesson-1",
        block_id: "block-question-1",
        answered_at: "2026-09-01T08:45:00.000Z",
        question_text: "Какой результат ожидается?",
        options: ["Успех", "Ошибка 500"],
        selected_indexes: [1],
        correct_indexes: [0],
        is_correct: false,
      },
      {
        user_id: "student-2",
        lesson_id: "lesson-1",
        block_id: "block-question-1",
        answered_at: "2026-09-01T08:50:00.000Z",
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
  assert.equal(analytics.totals.started, 2);
  assert.equal(analytics.totals.completed, 1);
  assert.equal(analytics.totals.manualHomeworkApproved, 1);
  assert.equal(analytics.totals.manualHomeworkAwaitingMentor, 1);
  assert.equal(analytics.totals.medianFinalQuizMinutes, 20);
  assert.equal(
    analytics.students.find((student) => student.id === "student-1")?.passedCourse,
    true,
  );
  assert.equal(analytics.students.find((student) => student.id === "student-2")?.idleDays, 34);
  assert.equal(
    analytics.students.find((student) => student.id === "student-2")?.awaitingMentorHomework,
    1,
  );
  assert.equal(analytics.students.find((student) => student.id === "student-2")?.elapsedDays, null);
  assert.deepEqual(
    analytics.lessonFunnel.map(({ dayNumber, started, completed, completionPercent }) => ({
      dayNumber,
      started,
      completed,
      completionPercent,
    })),
    [
      { dayNumber: 1, started: 2, completed: 1, completionPercent: 50 },
      { dayNumber: 2, started: 2, completed: 0, completionPercent: 0 },
    ],
  );
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
  assert.equal(analytics.totals.homeworkAssigned, 1);
  assert.equal(analytics.totals.homeworkSubmitted, 1);
  assert.equal(analytics.totals.homeworkNotSubmitted, 0);
  assert.equal(analytics.totals.homeworkSameCalendarDay, 1);
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
    homeworkMessages: [],
    homeworkBlocks: [],
    sqlAttempts: [],
    lessonQuestionAnswers: [],
    quizAttempts: [],
  });
  assert.equal(analytics.students[0]?.passedCourse, false);
  assert.equal(analytics.totals.completed, 0);
});

test("lesson reach analytics uses each student's course start date", () => {
  const analytics = buildCourseAnalytics({
    now: new Date("2026-10-07T20:00:00.000Z"),
    students: [
      {
        id: "student-a",
        full_name: "A",
        login: "a",
        created_at: null,
        course_start_at: "2026-10-05T21:00:00.000Z",
      },
      {
        id: "student-b",
        full_name: "B",
        login: "b",
        created_at: null,
        course_start_at: "2026-10-06T21:00:00.000Z",
      },
    ],
    lessons: [
      { id: "lesson-1", day_number: 1, title: "Урок 1" },
      { id: "lesson-2", day_number: 2, title: "Урок 2" },
    ],
    progress: [],
    blockProgress: [],
    submissions: [],
    homeworkMessages: [],
    homeworkBlocks: [],
    sqlAttempts: [],
    quizAttempts: [],
    lessonQuestionAnswers: [],
  });

  assert.equal(analytics.totals.started, 0);
  assert.deepEqual(
    analytics.lessonFunnel.map((item) => item.available),
    [2, 1],
  );
});
