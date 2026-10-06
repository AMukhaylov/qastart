import assert from "node:assert/strict";
import test from "node:test";
import { buildHomeworkSnapshots, countHomeworkTimings } from "../../src/lib/course-homework.ts";

const lessons = [
  { id: "day-1", day_number: 1, homework_md: "Напишите ответ" },
  { id: "day-2", day_number: 2, homework_md: "Ещё задание" },
  { id: "day-11", day_number: 11, homework_md: "" },
];
const blocks = [
  {
    id: "sql-block",
    lesson_id: "day-11",
    content: { mode: "sql_sandbox", sandbox: { tasks: [{ id: "a" }, { id: "b" }] } },
  },
];

test("records schedule, completion, first and last submission timestamps without deadlines", () => {
  const snapshots = buildHomeworkSnapshots({
    courseStartAt: "2026-10-05T21:00:00Z",
    now: new Date("2026-10-06T19:30:00Z"),
    lessons: [lessons[0]!],
    progress: [{ lesson_id: "day-1", completed: true, completed_at: "2026-10-06T14:30:00Z" }],
    submissions: [
      {
        id: "submission-1",
        lesson_id: "day-1",
        created_at: "2026-10-06T16:30:00Z",
        status: "approved",
      },
    ],
    messages: [
      { submission_id: "submission-1", author_role: "student", created_at: "2026-10-06T16:30:00Z" },
      { submission_id: "submission-1", author_role: "mentor", created_at: "2026-10-06T17:00:00Z" },
      { submission_id: "submission-1", author_role: "student", created_at: "2026-10-08T16:30:00Z" },
    ],
    homeworkBlocks: [],
    sqlAttempts: [],
  });

  assert.deepEqual(snapshots[0], {
    lessonId: "day-1",
    dayNumber: 1,
    lessonAvailableAt: "2026-10-05T21:00:00.000Z",
    lessonCompletedAt: "2026-10-06T14:30:00Z",
    firstSubmittedAt: "2026-10-06T16:30:00Z",
    lastSubmittedAt: "2026-10-08T16:30:00Z",
    delayHours: 2,
    assigned: true,
    sameCalendarDay: true,
    reviewStatus: "approved",
  });
  assert.deepEqual(countHomeworkTimings(snapshots), {
    assigned: 1,
    submitted: 1,
    notSubmitted: 0,
    sameCalendarDay: 1,
    under24Hours: 1,
    hours24To48: 0,
    hours48To72: 0,
    over72Hours: 0,
    averageDelayHours: 2,
    medianDelayHours: 2,
  });
});

test("does not count homework before the lesson is completed and counts it as unsubmitted after", () => {
  const snapshots = buildHomeworkSnapshots({
    lessons: lessons.slice(0, 2),
    progress: [{ lesson_id: "day-1", completed: true, completed_at: "2026-10-06T14:30:00Z" }],
    submissions: [],
    homeworkBlocks: [],
    sqlAttempts: [],
  });
  assert.deepEqual(countHomeworkTimings(snapshots), {
    assigned: 1,
    submitted: 0,
    notSubmitted: 1,
    sameCalendarDay: 0,
    under24Hours: 0,
    hours24To48: 0,
    hours48To72: 0,
    over72Hours: 0,
    averageDelayHours: null,
    medianDelayHours: null,
  });
});

test("counts homework as issued only after its individual scheduled lesson day", () => {
  const snapshots = buildHomeworkSnapshots({
    courseStartAt: "2026-10-05T21:00:00.000Z",
    now: new Date("2026-10-07T21:00:00.000Z"),
    lessons: lessons.slice(0, 2),
    progress: [{ lesson_id: "day-1", completed: true, completed_at: "2026-10-06T15:00:00Z" }],
    submissions: [],
    homeworkBlocks: [],
    sqlAttempts: [],
  });

  assert.deepEqual(
    snapshots.map(({ lessonId, assigned, lessonAvailableAt }) => ({
      lessonId,
      assigned,
      lessonAvailableAt,
    })),
    [
      { lessonId: "day-1", assigned: true, lessonAvailableAt: "2026-10-05T21:00:00.000Z" },
      { lessonId: "day-2", assigned: true, lessonAvailableAt: "2026-10-06T21:00:00.000Z" },
    ],
  );
  assert.equal(snapshots[1]?.lessonCompletedAt, null);
  assert.equal(snapshots[1]?.firstSubmittedAt, null);
  assert.equal(snapshots[1]?.delayHours, null);
});

test("SQL homework is submitted after all configured tasks pass", () => {
  const snapshots = buildHomeworkSnapshots({
    lessons: [lessons[2]!],
    progress: [{ lesson_id: "day-11", completed: true, completed_at: "2026-10-06T14:30:00Z" }],
    submissions: [],
    homeworkBlocks: blocks,
    sqlAttempts: [
      { block_id: "sql-block", task_id: "a", passed: true, passed_at: "2026-10-07T10:00:00Z" },
      { block_id: "sql-block", task_id: "b", passed: true, passed_at: "2026-10-07T10:01:00Z" },
    ],
  });
  assert.equal(snapshots[0]?.firstSubmittedAt, "2026-10-07T10:01:00Z");
  assert.equal(snapshots[0]?.lastSubmittedAt, "2026-10-07T10:01:00Z");
  assert.equal(snapshots[0]?.delayHours, 19 + 31 / 60);
});
