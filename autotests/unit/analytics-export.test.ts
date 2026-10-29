import assert from "node:assert/strict";
import test from "node:test";
import { buildAnalyticsExport } from "../../src/lib/analytics-export.ts";

test("analytics export includes full metrics and feedback while pseudonymizing student identities", () => {
  const exported = buildAnalyticsExport(
    {
      generatedAt: "2026-10-29T10:00:00.000Z",
      totals: { students: 1 },
      students: [
        {
          id: "private-user-id",
          name: "Анна Иванова",
          login: "anna@example.com",
          registeredAt: "2026-09-01T10:00:00.000Z",
          completedLessons: 4,
        },
      ],
      feedbackQuestionsByLesson: {
        "lesson-1": [{ id: "good", label: "Что было хорошо?", type: "textarea" }],
      },
      feedbackResponses: [
        {
          user_id: "private-user-id",
          lesson_id: "lesson-1",
          answers: { good: "Было понятно" },
          rating: 9,
          difficulty: "normal",
          comment: "",
        },
      ],
      feedbackSkips: [{ user_id: "private-user-id", lesson_id: "lesson-2" }],
    },
    new Date("2026-10-29T11:00:00.000Z"),
  );

  assert.deepEqual(exported.analytics.totals, { students: 1 });
  assert.deepEqual(exported.analytics.students, [
    { studentKey: "student_001", completedLessons: 4 },
  ]);
  assert.deepEqual(exported.feedback.questionsByLesson["lesson-1"], [
    { id: "good", label: "Что было хорошо?", type: "textarea" },
  ]);
  assert.equal(exported.feedback.responses[0]?.studentKey, "student_001");
  assert.equal(exported.feedback.responses[0]?.rating, 9);
  assert.deepEqual(exported.feedback.skipped, [
    { studentKey: "student_001", lesson_id: "lesson-2" },
  ]);
  assert.equal(exported.privacy.freeTextMayContainPersonalData, true);
  const serialized = JSON.stringify(exported);
  assert.equal(serialized.includes("private-user-id"), false);
  assert.equal(serialized.includes("anna@example.com"), false);
  assert.equal(serialized.includes("Анна Иванова"), false);
});
