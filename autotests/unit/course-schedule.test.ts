import assert from "node:assert/strict";
import test from "node:test";
import { courseDay, courseStartFromDate, lessonOpensAt } from "../../src/lib/course-schedule.ts";

test("students in one group follow their own calendar dates", () => {
  const a = courseStartFromDate("2026-10-06");
  const b = courseStartFromDate("2026-10-09");
  const now = new Date("2026-10-07T04:00:00Z");
  assert.equal(courseDay(a, now), 2);
  assert.equal(courseDay(b, now), 0);
  assert.equal(lessonOpensAt(a, 2), "2026-10-06T21:00:00.000Z");
  assert.equal(lessonOpensAt(b, 14), "2026-10-21T21:00:00.000Z");
});

test("course day changes at midnight in the course time zone", () => {
  const start = courseStartFromDate("2026-10-06");
  assert.equal(courseDay(start, new Date("2026-10-05T20:59:59Z")), 0);
  assert.equal(courseDay(start, new Date("2026-10-05T21:00:00Z")), 1);
});
